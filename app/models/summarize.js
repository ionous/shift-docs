// -----------------------------------------------------------
// Generate json summaries of specific events on particular days.
// -----------------------------------------------------------
const knex = require("../knex");
const dt = require("../util/dateTime");
const { EventStatus, Review } = require("./calConst");
const { CalEvent } = require("./calEvent");
const { CalDaily } = require("./calDaily");

// helper to generate a json summary of a caldaily, calevent joined pair.
// WARNING: conflicting fields ( like modified ) may not be reliable.
function defaultSummarize(evtDay) {
  // an invalid duration generates a null endTime; just like the php.
  const endtime = dt.to24HourString(CalEvent.getEndTime(evtDay));
  const evtJson = CalEvent.getSummary(evtDay);
  const dailyJson = CalDaily.getSummary(evtDay);
  // the php tacks the endtime to the ... end. so do we.
  return Object.assign( evtJson, dailyJson, {endtime} );
}

const summarize = {
  // Promises a summary of a single occurrence of a published event;
  // or null if not found or not published.
  // The 'summary' function should convert the joined event/day data to json.
  oneDaily(dayId, customSummaryFunction=null) {
    return CalDaily.getByDailyID(dayId, customSummaryFunction || defaultSummarize);
  },

  // Promises a (json) list of occurrences for a given event;
  // or a null list if no such published event or scheduled days exist.
  // The 'summary' function should convert the joined event/day data to json.
  // The 'id' is the event id
  entireEvent(id, customSummaryFunction=null) {
    const sum = customSummaryFunction || defaultSummarize;
    return knex
      .query('caldaily')
      .join('calevent', 'caldaily.id', 'calevent.id')
      .where('calevent.id', id)
      .whereRaw('not coalesce(hidden, 0)') // zero when published; null for legacy events.
      .whereNot('eventstatus', EventStatus.Delisted)
       // we're asking for just the first answer, so evtDay is a single result.
      .orderBy('eventdate')
      // we've asked for many entries, so evtDays is an array.
      // call the summary function on each one and return the transformed values.
      .then(evtDays => evtDays.map(sum));
  },

  // Promises a (json) list of published events within the specified date range.
  // The 'summary' function should convert the joined event/day data to json.
  // The 'firstDay' and 'lastDay' are datejs objects.
  dayRange(firstDay, lastDay, customSummaryFunction=null) {
    const sum = customSummaryFunction || defaultSummarize;
    return knex
      .query('caldaily')
      .join('calevent', 'caldaily.id', 'calevent.id')
      .whereRaw('not coalesce(hidden, 0)')           // calevent: zero when published; null for legacy events.
      .whereNot('review', Review.Excluded)           // calevent: a legacy status code.
      .whereNot('eventstatus', EventStatus.Skipped)  // caldaily: a legacy status code.
      .whereNot('eventstatus', EventStatus.Delisted) // caldaily: for soft deletion.
      .where('eventdate', '>=', firstDay.toDate())   // caldaily: instance of the event.
      .where('eventdate', '<=', lastDay.toDate())
      .orderBy('eventdate')
       // we've asked for many entries, so evtDays is an array.
       // call the summary function on each one and return the transformed values.
      .then(evtDays => evtDays.map(sum));
  },

  // Promises summaries of *all* events within the specified date range
  // including  delisted ones. ( see also: getRangeVisible )
  // The 'summary' function should convert the joined event/day data to json.
  // The 'firstDay' and 'lastDay' are datejs objects.
  fullRange(firstDay, lastDay, customSummaryFunction=null) {
    const sum = customSummaryFunction || defaultSummarize;
    return knex
      .query('caldaily') // fix: since this joins, might want to filter the join
      .join('calevent', 'caldaily.id', 'calevent.id')
      .whereRaw('not coalesce(hidden, 0)') // calevent: zero when published; null for legacy events.              // calevent: hidden is 0 once published
      //  -- we allow Review.Excluded entries --
      //  -- we allow EventStatus.Skipped entries --
      //  -- we allow EventStatus.Delisted entries --
      .where('eventdate', '>=', firstDay.toDate())
      .where('eventdate', '<=', lastDay.toDate())
      .orderBy('eventdate')
       // we've asked for many entries, so evtDays is an array.
       // call the summary function on each one and return the transformed values.
      .then(evtDays => evtDays.map(sum));
  }
}

module.exports = summarize;
