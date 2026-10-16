# World time and calendars (`Loom.time`)

The world has one clock. The server counts **world seconds** and keeps counting on its own while the world is not paused; every client computes the current time from the last snapshot it received, so `Loom.time.now` is always current without a message every second. A **calendar** is plain data that turns those seconds into a date and back.

```js
Loom.time.now;                 // world seconds, runs by itself
Loom.time.formatDate();        // e.g. "Sunday, 1 Frostmoon 1200 TM"
await Loom.time.advance(3600); // GM: skip one hour
```

## How the clock behaves

- The clock runs in server memory and is saved to the world every minute and on every change. A server crash loses at most the last minute.
- **Pausing the world pauses the clock**; resuming restarts it. A world opened with launch always starts paused, so its clock starts stopped.
- The clock keeps running during combat. Turn-based durations are a separate count (see the effects documentation).
- `timeScale` is how many world seconds pass per real second (default `1`; a GM can raise it, for example for travel). The limit is 100000.
- World time is a signed integer. Values are stored as 64-bit integers, so a calendar with a real year (such as 1492) fits.

## Reading the clock

| Member | Type | Description |
|--------|------|-------------|
| `Loom.time.now` | `number` | Current world time in seconds (interpolated, runs by itself). |
| `Loom.time.worldTime` | `number` | Same value as `now` (older name, kept for compatibility). |
| `Loom.time.scale` | `number` | World seconds per real second. |
| `Loom.time.paused` | `boolean` | `true` while the world is paused. |
| `Loom.time.calendar` | `CalendarDef` | Calendar the world uses (falls back to the Gregorian one when the id is unknown). |
| `Loom.time.calendars` | registry | Calendar registry: `register(def)` (returns the list of problems), `get(id)` and `getAll()`. See below. |
| `Loom.time.date(seconds?)` | `CalendarDate` | The calendar date of a world time (default: now). |
| `Loom.time.formatDate(seconds?)` | `string` | The date written with the calendar's `format` template. |
| `Loom.time.addDuration(start, amount, unit)` | `number` | World time `amount` units after `start`. `unit` is `seconds`, `minutes`, `hours`, `days`, `weeks`, `months` or `years`. Months and years follow the calendar (keeping the day, clamped to the month length). A negative or invalid `amount` counts as 0. |

`Loom.time.earthCalendar` is the older helper, unchanged, with fixed 365-day years and no leap days:

| Member | Description |
|--------|-------------|
| `Loom.time.earthCalendar.timeToComponents(seconds)` | Splits a number of seconds into `{ years, days, hours, minutes, seconds }`. |
| `Loom.time.earthCalendar.format(components, 'duration', options?)` | Formats the components as text, such as `"2 days 3 hours"`. `options` takes `maxTerms`, `short` (`"2d 3h"`) and `separator`. Any mode other than `'duration'` returns an empty string. |

## Changing the clock (GM only)

The server enforces the role; any other user gets `403`.

| Method | Description |
|--------|-------------|
| `await Loom.time.advance(seconds)` | Adds seconds to the world time. |
| `await Loom.time.set(seconds)` | Sets the world time. |
| `await Loom.time.setScale(scale)` | Sets the clock speed. |
| `await Loom.time.setCalendar(id)` | Picks the calendar of the world by id. |

These call `PUT /api/worlds/:id/time` (see the worlds API).

## Hooks

| Hook | Arguments | When |
|------|-----------|------|
| `updateWorldTime` | `(worldTime)` | Every time the server sends the clock (on change and about every 30 s). |
| `timeScaleChanged` | `(scale, previousScale)` | The clock speed changed. |
| `timePausedChanged` | `(paused)` | The world was paused or resumed. |

The server also sends the WebSocket event `time.updated` with `{ worldId, worldTime, timeScale, paused, serverNow, calendarId? }`.

## Registering a calendar

An addon declares a calendar as data and registers it. The data is a plain object in the shape described under [Calendar fields](#calendar-fields). It is JSON-serializable, so an addon can keep it in a JSON file, parse it, and pass the object to `register`. `register` returns the list of problems; an empty list means it was accepted. A calendar with the same `id` replaces the earlier one.

```js
const problems = Loom.time.calendars.register({
  id: 'two-moons',
  name: 'Calendar of the Two Moons',
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  weekdays: ['Sunday', 'Moonday', 'Fireday', 'Waterday', 'Windday'],
  months: [
    { name: 'Frostmoon', days: 30 },
    { name: 'Greenmoon', days: 30 },
    { name: 'Midyear Feast', days: 1, festival: true },
    { name: 'Sunmoon', days: 30 },
    { name: 'Harvestmoon', days: 30 },
    { name: 'Leap Feast', days: 0, leapDays: 1, festival: true },
  ],
  leapYear: { every: 4 },
  epochYear: 1200,
  eraName: 'TM',
  format: '{weekday}, {day} {month} {year} {era}',
});
if (problems.length) console.warn(problems);

await Loom.time.setCalendar('two-moons'); // GM
```

### Calendar fields

| Field | Required | Description |
|-------|----------|-------------|
| `id`, `name` | yes | Non-empty strings. |
| `secondsPerMinute`, `minutesPerHour`, `hoursPerDay` | yes | Positive integers. |
| `weekdays` | yes | Names of the days of the week, in order (at least one). |
| `epochWeekday` | no | Index in `weekdays` of the first day of the epoch year. Default `0`. |
| `months` | yes | List of `{ name, days, leapDays?, festival? }`. At least one month must have `days > 0`. |
| `leapYear` | no | `{ every, offset?, skipEvery?, restoreEvery? }`: a year is a leap year when `(year - offset)` is divisible by `every`; years divisible by `skipEvery` are not, unless also divisible by `restoreEvery` (the Gregorian rule is `every: 4, skipEvery: 100, restoreEvery: 400`). |
| `epochYear` | yes | The calendar year in which world time `0` falls (its first day). |
| `eraName` | no | Text for the `{era}` token. |
| `format` | no | Template with the tokens `{weekday}`, `{day}`, `{month}`, `{year}`, `{era}`, `{hour}`, `{minute}`, `{second}`. Default `{day} {month} {year} {era}`. |

Month fields:

- `days`: days in a normal year. `0` makes the month exist **only in leap years**.
- `leapDays`: extra days the month gets in a leap year (February in the Gregorian calendar has `days: 28, leapDays: 1`).
- `festival: true`: a named day outside the week cycle. It does not advance the weekday, and its date has an empty weekday name (the format drops the dangling separator).

A world time of `0` is the first second of the first day of `epochYear`. Negative times are dates before the epoch.

## Date object

`Loom.time.date()` returns `{ year, monthIndex, month, day, dayOfYear, weekday, weekdayName, hour, minute, second, isLeapYear, festival }`. `day` and `dayOfYear` start at 1. `weekday` is `-1` (and `weekdayName` is empty) on a festival day.

## Limits

- The `CONFIG.time.worldCalendarClass` slot is still not read by the core. Calendars are declarative definitions.
- A calendar registered with `Loom.time.calendars` lives only in the browser. It changes what `date`, `formatDate` and the clock display show, but not the server.
- The server knows only the Gregorian calendar. `setCalendar` stores any id (up to 64 characters) without checking it, and the server falls back to Gregorian for an id it does not know. Effect durations in months and years (see [Effects](effects.md)) are therefore converted with Gregorian, even in a world that uses a client-registered calendar.
