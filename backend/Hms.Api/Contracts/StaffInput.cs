using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record StaffInput([Required, EmailAddress, StringLength(254)] string Email, [Required, StringLength(100)] string Name, [Required] string Role, [StringLength(256, MinimumLength = 12)] string? Password);
