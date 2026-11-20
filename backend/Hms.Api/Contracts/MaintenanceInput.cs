using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record MaintenanceInput(Guid RoomId, [Required, StringLength(500)] string Description);
