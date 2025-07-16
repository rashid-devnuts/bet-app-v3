# Team Total Goals Partitioned Layout

## Overview
This feature adds a special partitioned layout for Team Total Goals markets and related team goal markets to improve user experience by clearly separating odds for each team.

## Supported Markets
The partitioned layout is applied to the following market types:
- Team Total Goals
- Home Team Exact Goals  
- Away Team Exact Goals

## Layout Structure
The partitioned layout consists of:

### Left Side (Team 1)
- Team name header with background styling
- Grid of betting options for the home team (label: "1")
- Each option shows the team name and the over/under threshold as a badge

### Visual Partition
- A vertical divider line between the two teams
- Styled with gray color and rounded corners for better visual separation

### Right Side (Team 2)
- Team name header with background styling
- Grid of betting options for the away team (label: "2")
- Each option shows the team name and the over/under threshold as a badge

## Implementation Details

### Detection Logic
The system detects team goal markets by checking if the market description contains:
- "team total goals"
- "home team exact goals"
- "away team exact goals"

### Data Structure
The betting options are filtered by their `label` field:
- `label: "1"` → Home team options
- `label: "2"` → Away team options

The `total` field contains the over/under threshold (e.g., "Over 0.5", "Under 1.5")

### Styling
- Team headers: Gray background with semibold text
- Partition: 2px wide gray line with rounded corners
- Grid layout: 2 columns for each team's options
- Responsive design that works on mobile and desktop

## Benefits
1. **Clear Visual Separation**: Users can easily distinguish between team options
2. **Better Organization**: Related betting options are grouped logically
3. **Improved UX**: Reduces confusion when comparing odds between teams
4. **Consistent Layout**: Maintains the same visual pattern across all team goal markets

## Files Modified
- `client/components/match/BettingTabs.jsx`: Added partitioned layout logic and styling 