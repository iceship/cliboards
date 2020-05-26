const Clien = require('./clien');
const SLRClub = require('./slrclub');
const Ruliweb = require('./ruliweb');

const crawlers = [Clien, SLRClub, Ruliweb];

const getCrawler = (index) => new crawlers[index]();

module.exports = { getCrawler, crawlers: crawlers.map((c) => c.toString()) };
