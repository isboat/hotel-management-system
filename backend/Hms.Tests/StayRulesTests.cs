using Hms.Api.Data;

namespace Hms.Tests;

public sealed class StayRulesTests
{
    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(365, true)]
    [InlineData(366, false)]
    [InlineData(-1, false)]
    public void ValidatesStayLength(int nights, bool expected)
    {
        var arrival = new DateOnly(2026, 1, 1);
        Assert.Equal(expected, StayRules.ValidDates(arrival, arrival.AddDays(nights)));
    }

    [Theory]
    [InlineData("Confirmed", "CheckedIn", true)]
    [InlineData("CheckedIn", "CheckedOut", true)]
    [InlineData("CheckedOut", "CheckedIn", false)]
    [InlineData("Confirmed", "CheckedOut", false)]
    public void ValidatesStatusTransition(string current, string next, bool expected) =>
        Assert.Equal(expected, StayRules.CanTransition(current, next));
}
