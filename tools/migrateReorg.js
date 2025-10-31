/**
 * migrate from old tables to new tables
 * ex. npm run -w tools reorg-tables
 */
const db = require("shift-docs/knex");
const dt = require("shift-docs/util/dateTime");
const path = require('node:path');
const { Area, Audience, EventStatus, Review, RideLength } = require("shift-docs/models/calConst");

async function migrate() {
  // do this the slow dumb way
  const all = await db.query('calevent').joinRaw('left join caldaily using(id)').orderBy('id', 'eventdate');
  const events = {};
  all.forEach(curr => {
    // add it as an event if we haven't seen it before
    const evt = events[curr.id] || curr;
    // add it as a day as well, or add it to other days
    evt.allDays = (evt.allDays || []).concat(curr);
    // and store whatever we did.
    events[curr.id] = evt;
  });
  
  return db.query.transaction(async(tx) => {
    for (const id in events) {
      const evt = events[id];
      const days = evt.allDays;
      const anyValid = days.find(at => isScheduled(at) !== null);
      if (!anyValid) {
        console.log(`skipping event ${evt.id} ${evt.eventdate} ${evt.review} ${evt.title}`);
      } else {
        await addEvent(tx, evt)
        await insertDays(tx, days)
      }
    }
  });
}
async function addEvent(tx, evt) {
  await addLede(tx, evt);
  await addPrivate(tx, evt);
  await addPrint(tx, evt);
  await addWeb(tx, evt);
  await addImage(tx, evt);
  await addStart(tx, evt);
  await addFinish(tx, evt);
  await addTags(tx, evt);
}
async function insertDays(tx, days) {
  for (const at of days) {
    await tx('status').insert({
      series: at.id, 
      ymd: at.eventdate,
      news: at.newsflash || null,
      scheduled: isScheduled(at),
    });
  }
}
async function addLede(tx, evt) {
  // zero and null are considered visible.
  const hidden = evt.hidden === 1;
  const published = !hidden ? (evt.changes || 1) : 0;
  const secret = evt.password || null;
  // 
  let {modified, created } = evt;
  if (dt.convert(modified).isBefore(created)) {
    const swap = modified;
    modified = created;
    created= modified;
  }
  await tx('lede').insert({
    series: evt.id,
    created: evt.created,
    modified: evt.modified,
    title: evt.title,
    summary: evt.descr,
    organizer: evt.name, 
    secret,
    published,
  });
}
async function addPrivate(tx, evt) {
  await tx('private').insert({
    series: evt.id,
    private_email: evt.email || null,
    private_phone: evt.phone || null,
    private_contact: evt.contact || null,
    show_email: evt.hideemail === 0,
    show_phone: evt.hidephone === 0,
    show_contact: evt.hidecontact === 0,
  });
}
async function addPrint(tx, evt) {  
  function eatNone(str) {
    return str === "none" ? null : str;
  }
  // munge and don't store if we can generate it.
  const munged = (evt.title || "").substring(0, 24).trim();
  const dbtiny = (evt.tinytitle || "").trim();
  // build the print data
  const print = {
    series:       evt.id,
    tiny_title:   eatNone((munged === dbtiny) ? null : dbtiny),
    tiny_summary: eatNone(evt.printdescr || null),
    add_email:    !!evt.printemail,   // false if never set ( null )
    add_phone:    !!evt.printphone,   // false if never set ( null )
    add_link:     !!evt.printweburl,  // false if never set ( null )
    add_contact:  !!evt.printcontact, // false if never set ( null )
  };
  return hasData(print) && tx('print').insert(print);
}
async function addWeb(tx, evt) {   
  // believe it or not, there are two events with a webname and no url.
  if (evt.weburl || evt.webname) {
    await tx('web').insert({
      series   : evt.id,
      web_type: 'url',
      web_text: evt.webname || null,
      web_link: evt.weburl,
    });
  }
}
async function addImage(tx, evt) {   
  const { image } = evt;
  if (!!image) {
    const img = getImageData(evt.id, image);
    if (img) {
      if (!isValidExt(img.ext)) {
        console.log(`skipping image ${image}`)
      } else {
        await tx('image').insert(img.override ? {
          series: evt.id,
          img_override: img.override,
        } : {
          series: evt.id,
          img_version: img.num,
          img_ext: img.ext,
        });
      }
    }
  }
}
async function addStart(tx, evt) {   
  await tx('location').insert({
    series: evt.id,
    loc_type: 'start',
    loc_name: evt.locname,
    loc_time: evt.eventtime,
    loc_address: evt.address, 
    place_info: evt.locdetails,
    time_info: evt.timedetails,
  });
}
// minutes from db timestamp
function timeToMinutes(time) {
  const [ hr, min, _ ] = time.split(':');
  return parseInt(hr) * 60 + parseInt(min);
}
// https://dev.mysql.com/doc/refman/8.4/en/time.html
//  With the fractional part included, the range for TIME values is '-838:59:59.000000' to '838:59:59.000000'.
function minutesToTime(minutes) {
  const hrs = Math.trunc(minutes / 60);
  const min = minutes - (hrs * 60);
  function pad(n) {
    return ('' + n).padStart(2, '0');
  }
  return [pad(hrs), pad(min), '00'].join(':');
}
async function addFinish(tx, evt) {   
  let finish;
  if (evt.eventduration) {
    finish = minutesToTime(evt.eventduration + timeToMinutes(evt.eventtime));
  }
  const d = {
    series: evt.id,
    loc_name: evt.locend || null,
    loc_time: finish || null,
  };
  if (hasData(d)) {
    d.loc_type = 'finish';
    await tx('location').insert(d);
  }
}
async function addTags(tx, evt) {   
  const tags = {};
  // note: there are 9 rides from 2023 with no audience and no area
  // two of which seem to be tests... dunno what's best for them.
  if (evt.area && evt.area !== Area.Portland) {
    tags.area = reverseLookup(Area, evt.area); 
  }
  if (evt.audience && evt.audience !== Audience.General) {
    tags.audience = reverseLookup(Audience, evt.audience);
  }
  if (RideLength[evt.ridelength]) {
    tags.distance = evt.ridelength;
  }
  // false zero or null
  if (!!evt.loopride) {
    tags.loop = "true";
  }
  if (!!evt.safetyplan) {
    tags.safety = "true";
  }
  if (!!evt.highlight) {
    tags.featured = "true";
  }
  for (const key in tags) {
    const value = tags[key];
    // console.log(`tag ${evt.id} ${key} ${value}`);
    await tx('tag').insert({
      series: evt.id, 
      tag_name: key,
      tag_value: value,
    });
  }
}
// for Area 'P' return "Portland"
function reverseLookup(group, value) {
  for (const k in group) {
    if (value === group[k]) {
      return k;
    }
  }
}
// ---- helpers
function getImageData(series, image) {
  // match 123.jpg or 123-456.jpg
  // excludes .JPG -> and uses the override path for that.
  // the current 'uploader' always uses lowercase extensions.
  const match = image.match(/^(\d+)(\.|-(\d+)\.)([a-z]+)$/);
  if (!match) {
    return getImageOverrideData(image);
  } else {
    const [ _fullstring, id, _dashdot, num, ext ] = match;
    // loose compare b/c regex returns strings; but the series is a number
    if (id != series) {
      return getImageOverrideData(image);
    } else {
      return { 
        ext,
        num: num !== undefined ? parseInt(num) : null,
      }
    }
  }
}
// does the passed data have an valid values other than 'series'
function hasData(d) {
  const keys = Object.keys(d);
  return keys.find(k => d[k] && k !== 'series');
}
function getImageOverrideData(image) {
  const baseName = path.basename(image);
  const ext = path.extname(image);
  // there are a couple of files with empty extensions:
  // ex "714." -- lets just drop those.
  return baseName && ext && ext.length > 1 && {
    ext: ext.slice(1), // skip the leading dot
    override: baseName, // we keep the whole thing for override include extension 
  };
}

// ex. "png"
function isValidExt(ext) {
  // NOTE: this drops a random cfm file;
  const validExts = ['gif', 'png', 'jpg','jpeg','pjpeg', 'pjp', 'jfif'];
  return validExts.includes(ext.toLowerCase());
}

function isScheduled(at) {
  if (at.eventstatus === EventStatus.Active) {
    return true;
  } else if (at.eventstatus === EventStatus.Cancelled) {
    return false;
  } else {
    // we have some that are 'E', or 'S'
    // they are legacy and we don't display them correctly
    return null; 
  }
}

// --------------------
// boilerplate
async function runTool() {
  return db.initialize()
    .then(migrate)
    .then(_ => {
      console.log("done");
      // can't use top-level "await" with commonjs modules
      // ( ie. await makeFakeEvents() )
      process.exit()
    });
};
runTool();
