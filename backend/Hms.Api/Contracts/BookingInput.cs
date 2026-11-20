using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record BookingInput(Guid RoomId, [Required, StringLength(150)] string Guest, DateOnly Arrival, DateOnly Departure, Guid? GuestId);
