const puppeteer = require('puppeteer');
const chalk = require('chalk');

const { getUrl, boards } = require('./constants');

class Clien {
    async init() {
        if (this.browser) return;

        try {
            this.currentBoardIndex = 0;
            this.currentPageNumber = 0;

            this.browser = await puppeteer.launch({ headless: true });

            this.page = await this.browser.newPage();
            await this.page.setUserAgent(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.122 Safari/537.36'
            );
            await this.page.setRequestInterception(true);
            this.page.on('request', (request) => {
                if (
                    ['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1
                ) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            return this;
        } catch (e) {
            console.error(e);
        }
    }

    async changeBoard(boardValue) {
        if (typeof boardValue === 'string') {
            this.currentBoardIndex = boards.findIndex((board) => board.value === boardValue);
        } else if (typeof boardValue === 'number') {
            this.currentBoardIndex = boardValue;
        }
        return await this.getPosts();
    }

    async changePageNumber(pageNumber) {
        this.currentPageNumber = pageNumber;
        return await this.getPosts();
    }

    async getPostDetail(link) {
        try {
            await this.page.goto(link);

            const post = await this.page.evaluate(() => {
                const body = document.querySelector('.post_article');
                const comments = document.querySelectorAll('.comment_row');

                return {
                    body: body.textContent.trim(),
                    comments: Array.from(comments).map((comment) => {
                        const body = comment.querySelector('.comment_content');
                        const author = comment.querySelector('.contact_name');
                        const time = comment.querySelector('.comment_time');

                        return {
                            author:
                                author.innerText || author.querySelector('img').getAttribute('alt'),
                            time: time.innerText.split(' ')[0],
                            body: body.innerText || '',
                        };
                    }),
                };
            });
            console.log(post);
        } catch (e) {
            console.error(e);
        }
    }

    async getPosts() {
        try {
            console.log(`${this.currentPageNumber + 1} 페이지`);

            await this.page.goto(
                getUrl(boards[this.currentBoardIndex].value) + this.currentPageNumber
            );

            const posts = await this.page.evaluate(() => {
                const lists = document.querySelectorAll('.list_content .list_item');

                return Array.from(lists).map((list) => {
                    const title = list.querySelector('.list_subject .subject_fixed');
                    const link = list.querySelector('.list_subject');
                    const author = list.querySelector('.list_author .nickname');
                    const hit = list.querySelector('.list_hit');
                    const time = list.querySelector('.list_time');
                    const upVotes = list.querySelector('.list_symph');
                    const numberOfComments = list.querySelector('.rSymph05');

                    return title && title.innerText
                        ? {
                              title: title.innerText.trim(),
                              author:
                                  author.innerText.trim() ||
                                  author.querySelector('img').getAttribute('alt'),
                              hit: hit.innerText.trim(),
                              time: time.innerText.trim().split(' ')[0],
                              link: 'https://clien.net' + link.getAttribute('href'),
                              upVotes: parseInt(upVotes.innerText),
                              numberOfComments: numberOfComments
                                  ? parseInt(numberOfComments.innerText)
                                  : 0,
                          }
                        : null;
                });
            });

            const d = chalk.white('|');

            return posts
                .filter((posts) => posts)
                .map(({ title, author, link, upVotes, hit, time, numberOfComments }) => ({
                    name: `${
                        upVotes ? chalk.blueBright(upVotes) : chalk.gray.dim(upVotes)
                    } ${d} ${chalk.green.bold(title)}${
                        numberOfComments ? ' ' + chalk.white.dim(numberOfComments) : ''
                    } ${d} ${chalk.gray(author)} ${d} ${chalk.gray.dim(hit)} ${d} ${chalk.gray.dim(
                        time
                    )}`,
                    value: link,
                }));
        } catch (e) {
            console.error(e);
        }
    }

    async close() {
        try {
            await this.page.close();
            await this.browser.close();
        } catch (e) {
            console.error(e);
        }
    }
}

module.exports = new Clien();
