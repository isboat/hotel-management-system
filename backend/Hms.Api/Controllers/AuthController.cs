using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(HotelDatabase database, IPasswordHasher<Staff> hasher, SessionTokens tokens) : ControllerBase
{
    /// <summary>Validates staff credentials and issues a short-lived signed access token.</summary>
    [EnableRateLimiting("credentials")]
    [HttpPost("login")]
    [AuditAction("logged in", "log in")]
    public async Task<IActionResult> Login(Credentials input)
    {
        var email = input.Email.Trim().ToUpperInvariant();
        var staff = await database.Staff.SingleOrDefaultAsync(row => row.Email == email);
        if (staff is null || hasher.VerifyHashedPassword(staff, staff.PasswordHash, input.Password) == PasswordVerificationResult.Failed)
            return Unauthorized();
        HttpContext.Items["AuditActor"] = staff.Id;
        return Ok(await tokens.Issue(staff, DateTime.UtcNow.AddHours(12)));
    }

    /// <summary>Consumes a refresh credential exactly once and preserves its original expiry.</summary>
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshInput input)
    {
        var digest = SessionTokens.Digest(input.RefreshToken);
        await using var transaction = await database.Database.BeginTransactionAsync();
        var session = await database.RefreshSessions.FindAsync(digest);
        if (session is null || session.ExpiresUtc <= DateTime.UtcNow) return Unauthorized();
        if (await database.RefreshSessions.Where(row => row.Digest == digest).ExecuteDeleteAsync() != 1)
            return Unauthorized();
        var staff = await database.Staff.SingleOrDefaultAsync(row => row.Id == session.StaffId && row.SessionVersion == session.Version);
        if (staff is null) return Unauthorized();
        var response = await tokens.Issue(staff, session.ExpiresUtc);
        await transaction.CommitAsync();
        HttpContext.Items["AuditActor"] = staff.Id;
        return Ok(response);
    }

    [Authorize]
    [HttpGet("properties")]
    public async Task<IActionResult> Properties() => Ok(await (
        from member in database.Memberships
        join hotel in database.Hotels on member.HotelId equals hotel.Id
        where member.StaffId == TenantAccess.Actor(User) && member.Active && !hotel.Suspended && !hotel.Archived
        orderby hotel.Name
        select new { hotel.Id, hotel.Name, member.Role }).ToListAsync());

    [Authorize]
    [HttpPost("logout")]
    [AuditAction("signed out", "sign out")]
    public async Task<IActionResult> Logout()
    {
        await database.Staff.Where(row => row.Id == TenantAccess.Actor(User))
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.SessionVersion, row => row.SessionVersion + 1));
        return NoContent();
    }

    /// <summary>Changes the signed-in staff member's password and invalidates their existing sessions.</summary>
    [Authorize]
    [EnableRateLimiting("credentials")]
    [HttpPost("change-password")]
    [AuditAction("changed their password", "change their password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordInput input)
    {
        var staff = await database.Staff.SingleOrDefaultAsync(row => row.Id == TenantAccess.Actor(User));
        if (staff is null || User.FindFirst("session_version")?.Value != staff.SessionVersion.ToString())
            return Unauthorized();
        if (hasher.VerifyHashedPassword(staff, staff.PasswordHash, input.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest("The current password is incorrect.");
        if (input.NewPassword == input.CurrentPassword)
            return BadRequest("Choose a password different from your current password.");

        var hash = hasher.HashPassword(staff, input.NewPassword);
        await using var transaction = await database.Database.BeginTransactionAsync();
        await database.PasswordResets.Where(row => row.StaffId == staff.Id).ExecuteDeleteAsync();
        var updated = await database.Staff.Where(row => row.Id == staff.Id && row.SessionVersion == staff.SessionVersion)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.PasswordHash, hash)
                .SetProperty(row => row.SessionVersion, row => row.SessionVersion + 1));
        if (updated == 0) return Unauthorized();
        await transaction.CommitAsync();
        return NoContent();
    }

    /// <summary>Consumes a reset code and invalidates all prior access tokens.</summary>
    [EnableRateLimiting("credentials")]
    [HttpPost("reset")]
    [AuditAction("reset their password", "reset their password")]
    public async Task<IActionResult> Reset(ResetInput input)
    {
        var digest = SessionTokens.Digest(input.Code);
        await using var transaction = await database.Database.BeginTransactionAsync();
        var reset = await database.PasswordResets.FindAsync(digest);
        if (reset is null || reset.ExpiresUtc <= DateTime.UtcNow) return BadRequest("Invalid or expired reset code.");
        if (await database.PasswordResets.Where(row => row.Digest == digest).ExecuteDeleteAsync() != 1)
            return BadRequest("Invalid or expired reset code.");
        var staff = await database.Staff.SingleAsync(row => row.Id == reset.StaffId);
        var hash = hasher.HashPassword(staff, input.Password);
        await database.Staff.Where(row => row.Id == staff.Id).ExecuteUpdateAsync(set =>
            set.SetProperty(row => row.PasswordHash, hash).SetProperty(row => row.SessionVersion, row => row.SessionVersion + 1));
        await database.PasswordResets.Where(row => row.StaffId == staff.Id).ExecuteDeleteAsync();
        await transaction.CommitAsync();
        HttpContext.Items["AuditActor"] = staff.Id;
        return NoContent();
    }
}
