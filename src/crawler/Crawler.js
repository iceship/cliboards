const puppeteer = require('puppeteer');

class Crawler {
    constructor() {
        if (this.constructor === Crawler) {
            throw new TypeError('Abstract class "Crawler" cannot be instantiated directly');
        }
    }

    async start() {
        if (this.browser) return;

        try {
            this.browser = await puppeteer.launch({ headless: true });

            this.page = await this.browser.newPage();
            await this.page.setUserAgent(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.122 Safari/537.36'
            );
            await this.page.setRequestInterception(true);

            this.page.on('request', (request) => {
                if (
                    [
                        'image',
                        'stylesheet',
                        'media',
                        'font',
                        'texttrack',
                        'object',
                        'beacon',
                        'imageset',
                    ].indexOf(request.resourceType()) !== -1
                ) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
        } catch (e) {}
    }

    async close() {
        try {
            await this.page.close();
            await this.browser.close();
        } catch (e) {}
    }
}

module.exports = Crawler;
