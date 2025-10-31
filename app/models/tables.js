// create tables if they dont already exist
// fix? modified time doesn't work for sqlite
// ( maybe manually set the time in knex.js store()? )
module.exports = {
  // promises the knex object after (trying) to create the tables.
  create: function(knex, mysql) {
    return createTables(knex, mysql, {
      caldaily(wrapper, knexTable) {
        createCalDaily(wrapper);
        knexTable.index(['eventdate'], 'eventdate');
      },
      calevent: createCalEvent, 
      lede: {
        cb: createLede,
        drop: true, 
      },
      status: {
        cb: createStatus,
        drop: true, 
      },
      private: {
        cb: createPrivate,
        drop: true, 
      },
      image: {
        cb: createImage,
        drop: true, 
      },
      location: {
        cb: createLocation,
        drop: true, 
      },
      tag: {
        cb: createTag,
        drop: true, 
      },
      print: {
        cb: createPrint,
        drop: true, 
      },
      web: {
        cb: createWeb,
        drop: true, 
      },
    }).then(async () => {
      await knex.schema.createView('public', (view) => {
        view.columns(['series', 'email', 'phone', 'contact']);
        const q = knex.raw(`
          select series,
                 case when show_email then private_email end as email,
                 case when show_phone then private_phone end as phone,
                 case when show_contact then private_contact end as contact
          from private
          where (email or phone or contact)
        `);
        view.as(q);
      });
      return knex;
    });
  }
};

async function createTables(knex, mysql, callbacks) {
  for (const name in callbacks) {
    const entry = callbacks[name];
    const cb = entry.cb ? entry.cb : entry; 
    if (entry.drop) {
      await knex.schema.dropTableIfExists(name);
    }
    const exists = await knex.schema.hasTable(name);
    if (!exists) {
      console.log("create", name);
      await knex.schema.createTable(name, (table) => {
        const wrapper = newTableMaker(knex, mysql, table);
        cb(wrapper, table);
      });
    }
  }
}

// table is a tableMaker
function createLede(table) {
  table.primaryKey('series');
  table.createdTime();
  table.modifiedTime();
  table.varchar('title');
  table.varchar('organizer'); 
  table.text('summary');
  table.varchar('secret', 50);
  table.integer('published');
}
function createStatus(table) {
  table.series('ymd');
  table.date('ymd', true); // true, must have a value.
  table.varchar('news');
  table.boolflag('scheduled', false); // false, doesnt need a value (nullable)
}
function createPrivate(table) {
  table.series();
  table.varchar('private_email');
  table.varchar('private_phone');
  table.varchar('private_contact');
  table.boolflag('show_email');
  table.boolflag('show_phone');
  table.boolflag('show_contact');
}
function createPrint(table) {
  table.series();
  table.varchar('tiny_title');
  table.varchar('tiny_summary'); // was: printdescr
  table.boolflag('add_email');
  table.boolflag('add_phone');
  table.boolflag('add_link');
  table.boolflag('add_contact');
}
function createWeb(table) {
  table.series('web_type');
  table.varchar('web_type', 32, true);
  table.varchar('web_text');
  table.varchar('web_link', 512);
}
function createImage(table) {
  table.series();
  table.integer('img_version');  // a counter
  table.varchar('img_ext', 8);   // "png" or "PNG"
  table.varchar('img_override');
  table.varchar('img_alt', 512);
}
function createLocation(table) {
  table.series('loc_type');
  table.varchar('loc_type', 32, true);
  table.time('loc_time');
  table.varchar('loc_name');
  table.varchar('loc_address');
  table.varchar('place_info');
  table.varchar('time_info');
}
function createTag(table) {
  table.series('tag_name');  
  table.varchar('tag_name', 32, true);
  table.varchar('tag_value', 128, true); // not nullable, and no explicit default
}

// table is a tableMaker
// order based on existing tables to support reading dumps
// ( see also: setup.sql )
function createCalDaily(table) {
  table.modifiedTime();   // note: caldaily doesnt use createdTime
  table.integer('id');    // a reference to CalEvent.id
  table.text('newsflash', "mediumtext"); // medium text supports up to 16 MiB(!)
  table.date('eventdate');
  table.varchar('eventstatus', 1);  // see: EventStatus (calConst.js); varchar, not char.
  table.integer('exceptionid');     // legacy
  table.primaryKey('pkid');
}

// table is a tableMaker
// order based on existing tables to support reading dumps
// ( see also: setup.sql )
function createCalEvent(table) {
  table.createdTime();
  table.modifiedTime();
  table.integer('changes', 0);
  table.primaryKey('id');
  table.varchar('name');
  table.varchar('email');
  table.flag('hideemail');
  table.flag('emailforum');        // legacy
  table.flag('printemail');
  table.varchar('phone');
  table.flag('hidephone');
  table.flag('printphone');
  table.varchar('weburl', 512);
  table.varchar('webname');
  table.flag('printweburl');
  table.varchar('contact');       // arbitrary organizer contact information
  table.flag('hidecontact');
  table.flag('printcontact');
  table.varchar('title');
  table.varchar('tinytitle', 255, true); // true: not nullable but no explicit default
  table.enum('audience');         // see: Audience (calConst.js)
  table.text('descr');
  table.text('printdescr');
  table.varchar('image');         // currently, always "id.ext", some older (2016) rides have a name.
  table.integer('imageheight');   // legacy, not used since 2019
  table.integer('imagewidth');
  table.varchar('dates');         // legacy, unused since 2019 ( includes text like "Monday, June 23" )
  table.enum('datestype');        // see: DatesType (calConst.js)
  table.time('eventtime');        // rides occur on one or more days, all at the same time.
  table.integer('eventduration'); // number of minutes; usually treated as 60 minutes when not specified.
  table.varchar('timedetails');
  table.varchar('locname');
  table.varchar('address');
  table.enum('addressverified');    // legacy, was: Y/N/V/X/A
  table.varchar('locdetails');
  table.varchar('locend');
  table.flag('loopride');
  table.enum('area');               // see: Area (calConst.js)
  table.varchar('external', 250);   // legacy, appears completely unused.
  table.varchar('source', 250);     // legacy, appears completely unused.
  table.integer('nestid');          // legacy, appears completely unused.
  table.varchar('nestflag', 1);     // legacy, appears completely unused; note varchar, not char.
  table.enum('review', 'I');        // see: Review (calConst.js)
  table.flag('highlight', true);    // true: not nullable but no explicit default
  table.tinyflag('hidden');         // 0 until published by the organizer
  table.varchar('password', 50);    // aka secret; autogenerated guid (mostly)
  table.varchar('ridelength');      // legacy, set to 12 for 2019's TNR; otherwise null.
  table.flag('safetyplan');
};

// wrapper to provide a simpler version of creating tables.
function newTableMaker(knex, mysql, table) {
  if (mysql) {
    table.engine("MyISAM");
  }
  return {
    primaryKey(name) {
      // knex creates these as unsigned; the original tables were signed
      // it should be fine; that's a lot of ids.
      // knex uses this as the primary key if another isn't specified.
      table.increments(name);
    },
    // a column to reference the series
    series(compositeKey) {
      const column = table.integer('series');
      column.notNullable();
      if (!compositeKey) {
        column.primary();
      } else {
        table.primary(['series', compositeKey]);
      }
    },
    // add a column for row created time
    createdTime() {
      table.timestamp('created')
      .notNullable()
      .defaultTo(knex.fn.now());
    },
    // add a column for row modified time
    // fix? modified time doesn't work for sqlite;
    // ( maybe manually set the time in knex.js store()? )
    modifiedTime() {
      const ts= table.timestamp('modified').notNullable();
      if (!mysql) {
        ts.defaultTo(knex.fn.now());
      } else {
        ts.defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      }
    },
    text(name, kind = "mediumtext", hasDefaultValue = false) {
      // medium text supports up to 16 MiB(!)
      // in the shift db, they don't have any sort of default.
      const column = table.text(name, kind);
      setDefaults(column, hasDefaultValue);
    },
    date(name, hasDefaultValue = false) {
     const column =  table.date(name);
     setDefaults(column, hasDefaultValue);
    },
    time(name, hasDefaultValue = false) {
     const column = table.time(name);
     setDefaults(column, hasDefaultValue);
    },
    // semantically meant for 0/1 true/false values.
    // the shift db uses integers for these.
    flag(name, hasDefaultValue = false) {
      const column = table.integer(name);
      setDefaults(column, hasDefaultValue);
    },
    // meant for 0/1 true/false values.
    // a 1 byte signed value ranging from -128 to 127
    tinyflag(name, hasDefaultValue = false) {
      const column = table.tinyint(name);
      setDefaults(column, hasDefaultValue);
    },
    // even smaller than tinyflag
    // a 0/1 flag that defaults to 0
    boolflag(name, hasDefaultValue = 0) {
      const column = table.tinyint(name, 1);
      setDefaults(column, hasDefaultValue);
    },
    // 4 byte signed value (-2147483648 to 2147483647)
    integer(name, hasDefaultValue = false) {
      // note: in the original tables `int(11)` is a *display* size
      // and its deprecated as of mysql 8.0.17
      // https://dev.mysql.com/doc/refman/8.0/en/numeric-type-attributes.html
      const column = table.integer(name);
      setDefaults(column, hasDefaultValue);
    },
    // a single character value ( A-Z )
    enum(name, hasDefaultValue = false) {
      const column = table.specificType(name, "char(1)");
      setDefaults(column, hasDefaultValue);
    },
    // a string containing no more than 'width' characters.
    varchar(name, width = 255, hasDefaultValue = false) {
      // note: knex string is mysql varchar(255)
      const column = table.string(name, width);
      setDefaults(column, hasDefaultValue);
    },
  };
}

// when hasDefaultValue is:
// . explicitly false, default to null
// . explicitly true, set as "not nullable"
// . otherwise: set "not nullable" and give it that default
function setDefaults(column, hasDefaultValue) {
  if (hasDefaultValue === false) {
    column.defaultTo(null);
  } else {
    column.notNullable();
    if (hasDefaultValue !== true) {
      column.defaultTo(hasDefaultValue)
    }
  }
}