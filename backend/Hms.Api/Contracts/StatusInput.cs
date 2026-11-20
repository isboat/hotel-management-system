using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record StatusInput([Required, StringLength(30)] string Status);
