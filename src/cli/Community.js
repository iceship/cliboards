const blessed = require('blessed');

const { name, version, homepage } = require('../../package.json');
const CLI = require('./CLI');
const { openUrls } = require('../helpers');
const { getCrawler, crawlers } = require('../crawler');

let autoRefreshTimer;

class Community extends CLI {
    constructor() {
        super();

        this.communityList = blessed.list({
            parent: this.bodyBox,
            tags: true,
            scrollbar: {
                ch: ' ',
                style: {
                    inverse: true,
                },
            },
            style: {
                selected: {
                    bg: this.colors.cursor_bg,
                    fg: this.colors.cursor_color,
                },
                bg: this.colors.list_bg,
                fg: this.colors.list_left_color,
            },
            keys: true,
            vi: true,
        });
        this.boardsList = blessed.list({
            scrollbar: {
                ch: ' ',
                style: {
                    inverse: true,
                },
            },
            style: {
                selected: {
                    bg: this.colors.cursor_bg,
                    fg: this.colors.cursor_color,
                },
                bg: this.colors.list_bg,
                fg: this.colors.list_left_color,
            },
            keys: true,
            vi: true,
        });
        this.listList = blessed.list({
            width: '100%',
            tags: true,
            scrollbar: {
                ch: ' ',
                style: {
                    inverse: true,
                },
            },
            style: {
                selected: {
                    bg: this.colors.cursor_bg,
                    fg: this.colors.cursor_color,
                },
                bg: this.colors.list_bg,
                fg: this.colors.list_left_color,
            },
            keys: true,
            vi: true,
        });
        this.detailBox = blessed.box({
            scrollable: true,
            tags: true,
            keys: true,
            vi: true,
            alwaysScroll: true,
            width: '100%',
            scrollbar: {
                ch: ' ',
                inverse: true,
            },
            style: {
                bg: this.colors.post__bg,
                fg: this.colors.post_color,
            },
        });

        this.widgets = [this.communityList, this.boardsList, this.listList, this.detailBox];
    }

    static start() {
        const community = new Community();

        community.setAllEvents();
        community.communityList.setItems(crawlers);
        community.communityList.focus();

        return community;
    }

    setKeyPressEvent() {
        super.setKeyPressEvent();

        this.communityList.on('keypress', (_, { full }) => {
            switch (full) {
                case 'o':
                    openUrls(homepage);
                    break;
                case 'y':
                    openUrls('https://www.youtube.com/watch?v=hpI2A4RTvhs');
            }
        });

        this.boardsList.on('keypress', async (_, { full }) => {
            const boardTypesLength = this.crawler.boardTypes.length;

            switch (full) {
                case 'r':
                    this.crawler.deleteBoards();
                    this.crawler.boards = [];
                    await this.getBoards(0);
                    break;
                case 'right':
                    this.currentBoardTypeIndex =
                        (this.currentBoardTypeIndex + 1) % boardTypesLength;
                    await this.getBoards(this.currentBoardTypeIndex);
                    break;
                case 'left':
                    if (!this.currentBoardTypeIndex) {
                        this.currentBoardTypeIndex = boardTypesLength - 1;
                    } else {
                        this.currentBoardTypeIndex =
                            (this.currentBoardTypeIndex - 1) % boardTypesLength;
                    }
                    await this.getBoards(this.currentBoardTypeIndex);
                    break;
            }
        });

        this.listList.on('keypress', async (_, { full }) => {
            if (autoRefreshTimer) {
                clearTimeout(autoRefreshTimer);
                autoRefreshTimer = null;
            }

            if (!this.posts.length) {
                return;
            }

            const prevPaggeNumber = this.crawler.pageNumber;
            const prevPosts = this.posts;
            const prevPostIndex = this.currentPostIndex;

            if (full === 'r') {
                // refresh
            } else if (full === 'a') {
                if (!autoRefreshTimer) {
                    autoRefreshTimer = setInterval(async () => {
                        await this.refreshPosts();
                    }, 10000); // repeat every 10 seconds; do not make it too low
                }
            } else if (full === 's') {
                if (this.crawler.sortUrl) {
                    this.crawler.changeSortList(1 ^ this.crawler.sortListIndex);
                } else {
                    return;
                }
            } else if (full === 'left' && this.crawler.pageNumber > 1) {
                this.crawler.navigatePage = -1;
            } else if (full === 'right') {
                this.crawler.navigatePage = 1;
            } else {
                return;
            }

            await this.refreshPosts();

            if (!this.posts.length) {
                // no more pages -> go back to the previous page
                this.crawler.pageNumber = prevPaggeNumber;
                this.posts = prevPosts;
                this.currentPostIndex = prevPostIndex;
                this.listList.focus();
            }
        });

        this.detailBox.on('keypress', async (_, { full }) => {
            if (!this.post) return;

            switch (full) {
                case 'r':
                    await this.refreshPostDetail();
                    break;
                case 'i':
                    await openUrls(this.post.images || null);
                    break;
                case 'o':
                    await openUrls(this.posts[this.currentPostIndex].link);
                    break;
                case 'h':
                case 'left':
                    if (this.currentPostIndex) {
                        this.currentPostIndex -= 1;
                        this.posts[this.currentPostIndex].hasRead = true;
                        await this.refreshPostDetail();
                    } else if (this.crawler.pageNumber > 1) {
                        this.crawler.navigatePage = -1;
                        await this.refreshPosts();
                        this.currentPostIndex = this.posts.length - 1;
                        this.posts[this.currentPostIndex].hasRead = true;
                        await this.refreshPostDetail();
                    }
                    break;
                case 'l':
                case 'right':
                    this.currentPostIndex += 1;

                    if (this.currentPostIndex === this.posts.length) {
                        const prevPosts = this.posts;
                        this.crawler.navigatePage = 1;

                        await this.refreshPosts();

                        if (this.posts.length) {
                            this.currentPostIndex = 0;
                        } else {
                            // no more pages -> go back to the last page
                            this.crawler.navigatePage = -1;
                            this.currentPostIndex = prevPosts.length - 1;
                            this.posts = prevPosts;
                        }
                    }

                    await this.refreshPostDetail();
                    this.posts[this.currentPostIndex].hasRead = true;
                    break;
            }
        });
    }

    setSelectEvent() {
        super.setSelectEvent();

        this.communityList.on('select', async (_, index) => {
            let postRead;

            if (this.crawler) {
                postRead = this.crawler.postsRead;
                await this.crawler.close();
            }
            this.crawler = getCrawler(index);

            if (postRead) {
                this.crawler.postsRead = postRead;
            }

            this.screen.title = this.crawler.title;
            await this.crawler.start();
            await this.getBoards(index);
            this.moveToWidget('next');
        });

        this.boardsList.on('select', async (_, index) => {
            await this.getPosts(index);
            this.moveToWidget('next');
        });

        this.listList.on('select', async (_, index) => {
            try {
                await this.getPostDetail(index);

                this.posts[index].hasRead = true;
                this.moveToWidget('next', () => {
                    this.rednerDetailBody();
                });
            } catch (e) {
                this.moveToWidget('next');
            }
        });
    }

    setFocusEvent() {
        super.setFocusEvent();

        this.communityList.on('focus', () => {
            this.screen.title = '';
            this.setTitleFooterContent(
                '커뮤니티 목록',
                '',
                `q: quit, o: open GitHub{|}${name} ${version}`
            );
        });

        this.boardsList.on('focus', () => {
            if (!this.crawler.boards.length) {
                this.setTitleFooterContent('Error', '', 'q: back');
                return;
            }
            this.currentPostIndex = 0;
            this.crawler.changeSortList(0);
            this.setTitleFooterContent(
                this.crawler.title,
                this.crawler.boardTypes[this.currentBoardTypeIndex],
                `q: back${this.crawler.canRefreshBoards ? ', r: refresh' : ''}${
                    this.crawler.boardTypes.length > 1 ? ', left/right arrow: prev/next page' : ''
                }`
            );
        });

        this.listList.on('focus', () => {
            if (!this.posts.length) {
                this.listList.setItems([]);
                this.setTitleFooterContent('Error', '', 'q: back');
                return;
            }

            this.listList.setItems(
                this.posts.map(
                    ({ category, title, numberOfComments, author, hasRead, hasImages }) =>
                        `${
                            category
                                ? `{${this.colors.list_info_color}-fg}` + category + '{/} '
                                : ''
                        }${
                            hasRead ? `{${this.colors.list_read_color}-fg}` + title + '{/}' : title
                        } {${this.colors.list_info_color}-fg}${
                            hasImages
                                ? '{underline}' + numberOfComments + '{/underline}'
                                : numberOfComments
                        }{/}  {|}{${this.colors.list_right_color}-fg}${author}{/}`
                )
            );
            this.resetScroll(this.listList, this.currentPostIndex);

            this.setTitleFooterContent(
                `${this.crawler.boards[this.crawler.currentBoardIndex].name} {gray-fg}${
                    this.crawler.boardTypes[this.currentBoardTypeIndex]
                }{/}`,
                `${this.crawler.pageNumber} 페이지${
                    this.crawler.sortUrl ? '‧' + this.crawler.sortUrl.name : ''
                }`,
                `q: back, r: refresh, a: auto refresh${
                    this.crawler.sortUrl ? ', s: sort' : ''
                }, left/right arrow: prev/next page`
            );
        });

        this.detailBox.on('focus', () => {
            if (!this.post) {
                this.detailBox.setContent('');
                this.flushComments();
                this.setTitleFooterContent('Error', '', 'q: back');
                return;
            }

            const {
                category,
                title,
                author,
                hit,
                upVotes,
                comments,
                time,
                images,
                hasImages,
            } = this.post;

            this.setTitleFooterContent(
                `${
                    category ? `{${this.colors.top_info_color}-fg}` + category + '{/} ' : ''
                }${title} {${this.colors.top_info_color}-fg}${comments.length}{/}`,
                `${author}‧${hit}‧${upVotes}‧${time}`,
                `q: back, r: refresh, o: open, ${
                    hasImages
                        ? `i: view ${images.length} image${images.length !== 1 ? 's' : ''}, `
                        : ''
                }left/right arrow: prev/next post`
            );
        });
    }

    setBlurEvent() {
        super.setBlurEvent();
    }

    setAllEvents() {
        this.setKeyPressEvent();
        this.setSelectEvent();
        this.setFocusEvent();
        this.setBlurEvent();
    }

    async getBoards(index) {
        try {
            this.currentBoardTypeIndex = index;

            if (!this.crawler.boards.length) {
                this.currentBoardTypeIndex = 0;
                this.footerBox.focus();
                await this.crawler.getBoards();
            }

            this.resetScroll(this.boardsList);
            this.boardsList.setItems(this.getFilteredBoards().map(({ name }) => name));
            this.boardsList.focus();
        } catch (e) {
            this.boardsList.setItems([]);
            this.boardsList.focus();
        }
    }

    getFilteredBoards() {
        const currentBoardType = this.crawler.boardTypes[this.currentBoardTypeIndex];
        return this.crawler.boards.filter(({ type }) => type === currentBoardType);
    }

    async getPosts(index) {
        try {
            this.footerBox.focus();
            this.posts = await this.crawler.changeBoard(this.getFilteredBoards()[index]);
        } catch (e) {
            this.posts = [];
        }
    }

    async refreshPosts() {
        const index = this.getFilteredBoards().indexOf(
            this.crawler.boards[this.crawler.currentBoardIndex]
        );
        await this.getPosts(index);
        this.currentPostIndex = 0;
        this.listList.focus();
    }

    async getPostDetail(index) {
        try {
            this.footerBox.focus();
            this.currentPostIndex = index;

            if (this.posts[index]) {
                this.post = await this.crawler.getPostDetail(this.posts[index].link);
            }
        } catch (e) {
            this.post = null;
            throw new Error(e);
        }
    }

    async refreshPostDetail() {
        try {
            const index = this.currentPostIndex;
            await this.getPostDetail(index);
            this.listList.select(index);
            this.rednerDetailBody();
        } catch (e) {
        } finally {
            this.detailBox.focus();
        }
    }

    rednerDetailBody() {
        this.detailBox.setContent(
            this.post.body.replace(/(GIF_\d+|IMAGE_\d+)/g, '{inverse}$&{/inverse}')
        );
        this.renderComments();
        this.detailBox.scrollTo(0);
    }

    renderComments() {
        this.flushComments();

        const { comments } = this.post;
        if (!comments || !comments.length) return;

        let prevTop = this.detailBox.getScreenLines().length + 1;

        this.commentBoxes = comments.map(
            ({ body, isRemoved, isReply, author, time, upVotes, downVotes }) => {
                const info = `{${this.colors.comment_top_color}-fg}${author}{|} ${
                    upVotes
                        ? `{${this.colors.comment_top_color_likes}-fg}${upVotes}{/${this.colors.comment_top_color_likes}-fg}‧`
                        : ''
                }${
                    downVotes
                        ? `{${this.colors.comment_top_color_dislikes}-fg}${downVotes}{/${this.colors.comment_top_color_dislikes}-fg}‧`
                        : ''
                }${time}{/}\n`;

                const commentBox = blessed.box({
                    parent: this.detailBox,
                    top: prevTop,
                    width: '100%-1',
                    height: parseInt(body.length / this.detailBox.width) + 5,
                    content: isRemoved
                        ? body
                        : info + body.replace(/(GIF_\d+|IMAGE_\d+)/g, '{inverse}$&{/inverse}'),
                    border: {
                        type: 'line',
                        fg: this.colors.comment_border_color,
                    },
                    style: {
                        bg: this.colors.comment_bg,
                        fg: this.colors.comment_bottom_color,
                    },
                    tags: true,
                    padding: {
                        left: isReply ? 4 : 0,
                    },
                });

                commentBox.height = commentBox.getScreenLines().length + 2;
                prevTop += commentBox.height - 1;

                return commentBox;
            }
        );
    }

    flushComments() {
        const { commentBoxes } = this;

        if (commentBoxes) {
            commentBoxes.map((box) => box.destroy());
            commentBoxes.length = 0;
        }
    }
}

module.exports = Community;
