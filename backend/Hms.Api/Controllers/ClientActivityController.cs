using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
public sealed class ClientActivityController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    private static readonly string[] PropertyScreens = ["Overview", "Rooms", "Reservations", "Guests", "Cash desk", "Staff", "Reports", "Audit log"];
    private static readonly string[] PlatformScreens = ["Tenants", "Audit log"];

    /// <summary>Records browser interactions without collecting field contents or button text.</summary>
    [HttpPost("api/v1/properties/{hotelId:guid}/activity")]
    [HttpPost("api/v1/platform/activity")]
    public async Task<IActionResult> Record(Guid? hotelId, ClientActivityInput input)
    {
        var property = hotelId.HasValue;
        if (property)
        {
            if (!await access.Allows(User, hotelId!.Value, "Administrator", "Manager", "FrontDesk", "Housekeeping", "Supervisor"))
                return Forbid();
        }
        else if (!await database.Staff.AnyAsync(row => row.Id == TenantAccess.Actor(User) && row.IsSystemAdmin))
            return Forbid();

        if (!(property ? PropertyScreens : PlatformScreens).Contains(input.Screen) ||
            input.Interaction is not ("View" or "Click" or "Change" or "Submit" or "Print"))
            return BadRequest();
        var target = property ? input.Screen : $"/api/v1/platform/{input.Screen}";
        database.Audit.Add(new AuditEvent(Guid.NewGuid(), hotelId, TenantAccess.Actor(User), DateTime.UtcNow,
            $"UI {input.Interaction}", target, 204, HttpContext.TraceIdentifier));
        await database.SaveChangesAsync();
        return NoContent();
    }
}
