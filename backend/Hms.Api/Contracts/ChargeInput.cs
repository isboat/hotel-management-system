using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record ChargeInput([Required, StringLength(150)] string Description, [Range(1, 100000000)] long Amount);
