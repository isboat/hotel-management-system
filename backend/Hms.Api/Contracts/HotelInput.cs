using System.ComponentModel.DataAnnotations;
using Hms.Api.Data;

namespace Hms.Api.Contracts;

public sealed record HotelInput([Required, StringLength(150)] string Name, [StringLength(40)] string? Telephone,
    [StringLength(1000)] string? Description, [StringLength(500)] string? Address)
{
    /// <summary>Applies profile fields without changing tenant identity or lifecycle status.</summary>
    public Hotel ApplyTo(Hotel hotel) => hotel with
    {
        Name = Name.Trim(),
        Telephone = Normalize(Telephone),
        Description = Normalize(Description),
        Address = Normalize(Address)
    };

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
