using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record CashCountInput([Range(0, 100000000)] long Amount);
