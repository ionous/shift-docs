const { allTables, extraKeys } = require("server/schema/allTables");
const allTriggers = require("server/schema/allTriggers");
const allViews = require("server/schema/allViews");
const { setupTables, setupStatements } = require("server/schema/setup");

// allows require("server/schema") to access any export
module.exports = {
  allTables,
  allTriggers,
  allViews,
  extraKeys,
  setupTables,
  setupStatements,
}