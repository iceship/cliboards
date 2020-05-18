const blessed = require('blessed');

const CLI = require('./CLI');
const { openUrls } = require('../helpers');
const {
    Clien,
    constants: { sortUrls },
} = require('../crawler/clien');

class Boards extends CLI {
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
        const boards = new Boards();

        boards.setKeyPressEvent();
        boards.setSelectEvent();
        boards.setFocusEvent();
        boards.setBlurEvent();

        boards.communityList.setItems(['CLEIN', 'DC INSIDE']);
        boards.communityList.focus();

        return boards;
    }

    setKeyPressEvent() {
        super.setKeyPressEvent();

        this.boardsList.on('keypress', async (_, { full }) => {
            switch (full) {
                case 'r':
                    this.crawler.deleteBoards();
                    this.crawler.boards.length = 0;
                    await this.getBoards(this.isSubBoard);
                    break;
                case 'right':
                    this.getCurrentBoards(true);
                    break;
                case 'left':
                    this.getCurrentBoards(false);
                    break;
            }
        });

        this.listList.on('keypress', async (_, { full }) => {
            if (!this.posts.length) return;

            const prevPaggeNumber = this.crawler.currentPageNumber;
            const prevPosts = this.posts;
            const prevPostIndex = this.currentPostIndex;

            if (full === 'r') {
                // refresh
            } else if (full === 's') {
                // 1 ^ this.crawler.sortListIndex: 1 -> 0 or 0 -> 1
                this.crawler.changeSortList(1 ^ this.crawler.sortListIndex);
                // this.listList.setItems([]);
            } else if (full === 'left' && this.crawler.currentPageNumber) {
                this.crawler.currentPageNumber -= 1;
            } else if (full === 'right') {
                this.crawler.currentPageNumber += 1;
            } else if (!isNaN(parseInt(full))) {
                this.crawler.currentPageNumber = full === '0' ? 9 : full - 1;
            } else {
                return;
            }

            await this.refreshPosts();

            if (!this.posts.length) {
                // no more pages -> go back to the previous page
                this.crawler.currentPageNumber = prevPaggeNumber;
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
                    } else if (this.crawler.currentPageNumber) {
                        this.crawler.currentPageNumber -= 1;
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
                        this.crawler.currentPageNumber += 1;

                        await this.refreshPosts();

                        if (this.posts.length) {
                            this.currentPostIndex = 0;
                        } else {
                            // no more pages -> go back to the last page
                            this.crawler.currentPageNumber -= 1;
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

        this.communityList.on('select', async (index) => {
            this.crawler = new Clien();
            this.screen.title = this.crawler.title;
            await this.crawler.start();

            await this.getBoards(false);
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
            this.setTitleFooterContent('test', '', 'q: quit');
        });

        this.boardsList.on('focus', () => {
            if (!this.boardsList.getItem(0)) {
                this.setTitleFooterContent('Error', '', 'q: quit, r: refresh');
                return;
            }
            this.currentPostIndex = 0;
            this.crawler.changeSortList(0);
            this.setTitleFooterContent(
                '클리앙',
                this.isSubBoard ? '소모임' : '커뮤니티',
                'q: quit, r: refresh, left/right arrow: prev/next page'
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
            this.listList.scrollTo(this.currentPostIndex);
            this.listList.select(this.currentPostIndex);

            this.setTitleFooterContent(
                this.crawler.boards[this.crawler.currentBoardIndex].name,
                `${this.crawler.currentPageNumber + 1} 페이지 | ${
                    sortUrls[this.crawler.sortListIndex].name
                }`,
                'q: back, r: refresh, s: sort, left/right arrow: prev/next page'
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
                `${author} | ${hit} | ${upVotes} | ${time}`,
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

    async getBoards(isSub) {
        try {
            if (!this.crawler.boards.length) {
                this.footerBox.focus();
                await this.crawler.getBoards();
                this.mainBoardsLength = this.crawler.boards.filter(({ isSub }) => !isSub).length;
            }

            this.isSubBoard = isSub;
            this.boardsList.setItems(
                this.crawler.boards
                    .filter(({ isSub }) => isSub === this.isSubBoard)
                    .map(({ name }) => name)
            );
            this.boardsList.focus();
        } catch (e) {
            this.boardsList.setItems([]);
            this.boardsList.focus();
        }
    }

    async getCurrentBoards(isSub) {
        this.boardsList.scrollTo(0);
        this.boardsList.select(0);
        isSub !== this.isSubBoard && (await this.getBoards(isSub));
    }

    async getPosts(index) {
        try {
            this.footerBox.focus();

            this.posts = await this.crawler.changeBoard(
                this.crawler.boards[this.isSubBoard ? index + this.mainBoardsLength : index]
            );
        } catch (e) {
            this.posts = [];
        }
    }

    async refreshPosts() {
        await this.getPosts(
            this.isSubBoard
                ? this.crawler.currentBoardIndex - this.mainBoardsLength
                : this.crawler.currentBoardIndex
        );
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
            await this.getPostDetail(this.currentPostIndex);
            this.listList.select(this.currentPostIndex);
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

        this.commentBoxes = comments.map(({ body, isRemoved, isReply, author, time, upVotes }) => {
            const info = `{${this.colors.comment_top_color}-fg}${author}{|} ${
                upVotes
                    ? `{${this.colors.comment_top_color_likes}-fg}${upVotes}{/${this.colors.comment_top_color_likes}-fg} | `
                    : ''
            }${time}{/}\n`;

            const commentBox = blessed.box({
                parent: this.detailBox,
                top: prevTop,
                width: '100%-1',
                height: parseInt(body.length / this.detailBox.width) + 5,
                content: isRemoved ? body : info + body,
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
        });
    }

    flushComments() {
        const { commentBoxes } = this;

        if (commentBoxes) {
            commentBoxes.map((box) => box.destroy());
            commentBoxes.length = 0;
        }
    }
}

module.exports = Boards;
