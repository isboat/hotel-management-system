using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record HotelInput([Required, StringLength(150)] string Name, [StringLength(40)] string? Telephone,
    [StringLength(1000)] string? Description, [StringLength(500)] string? Address);
