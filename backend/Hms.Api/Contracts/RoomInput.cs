using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record RoomInput([Required, StringLength(30)] string Number, [Required, StringLength(60)] string Type, [Range(1, 100)] int Capacity, [Range(0, 100000000)] long Rate, bool OutOfService);
