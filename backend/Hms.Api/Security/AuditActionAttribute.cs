namespace Hms.Api.Security;

/// <summary>Names the user operation and its fallback description for rejected attempts.</summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class AuditActionAttribute(string success, string attempt) : Attribute
{
    public string Success { get; } = success;
    public string Attempt { get; } = attempt;

    public static void Describe(HttpContext context, string description) =>
        context.Features.Set(new AuditDescription(description));

    public sealed record AuditDescription(string Text);
}
