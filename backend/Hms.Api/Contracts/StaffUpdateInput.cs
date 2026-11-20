using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record StaffUpdateInput([Required, StringLength(100)] string Name, [Required] string Role);
