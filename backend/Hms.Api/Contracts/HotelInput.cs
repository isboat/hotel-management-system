using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record HotelInput([Required, StringLength(150)] string Name);
