namespace Hms.Api.Data;

/// <summary>Defines valid stay lengths and reservation status transitions.</summary>
public static class StayRules
{
    public static bool ValidDates(DateOnly arrival, DateOnly departure) =>
        departure.DayNumber - arrival.DayNumber is > 0 and <= 365;

    public static bool CanTransition(string current, string next) =>
        (current, next) is ("Confirmed", "CheckedIn" or "Cancelled") or ("CheckedIn", "CheckedOut");
}
