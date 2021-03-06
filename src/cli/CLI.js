const blessed = require('blessed');

const { checkUpdate, getTheme } = require('../helpers');

class CLI {
    constructor() {
        this.isSubBoard = false;
        this.currentWidgetIndex = 0;
        this.colors = getTheme('default');

        this.screen = blessed.screen({
            dockBorders: true,
            fastCSR: true,
            fullUnicode: true,
        });
        const box = blessed.box({
            parent: this.screen,
            width: '100%',
            height: '100%',
        });
        this.titleBox = blessed.box({
            parent: box,
            tags: true,
            top: 0,
            width: '100%',
            height: 1,
            padding: {
                left: 2,
                right: 2,
            },
            style: {
                bg: this.colors.top_bg,
                fg: this.colors.top_left_color,
            },
        });
        this.bodyBox = blessed.box({
            parent: box,
            top: 1,
            bottom: 1,
            width: '100%',
            scrollbar: {
                ch: ' ',
                inverse: true,
            },
        });
        this.footerBox = blessed.box({
            parent: box,
            tags: true,
            width: '100%',
            top: '100%-1',
            height: 1,
            padding: {
                left: 2,
                right: 2,
            },
            style: {
                fg: this.colors.bottom_left_color,
                bg: this.colors.bottom_bg,
            },
        });

        process.on('exit', checkUpdate);
    }

    setKeyPressEvent() {
        this.screen.key('C-c', async () => {
            await this.terminate();
        });

        this.screen.key(['escape', 'q'], () => {
            !this.footerBox.focused && this.moveToWidget('prev');
        });
    }

    setSelectEvent() {
        //
    }

    setFocusEvent() {
        this.footerBox.on('focus', () => {
            this.footerBox.setContent(
                `${this.footerBox.getContent()} {|}{${
                    this.colors.bottom_right_color
                }-fg}Loading...{/}`
            );
            this.footerBox.style = { ...this.footerBox.style, bg: this.colors.bottom_bg_loading };
            this.screen.render();
        });
    }

    setBlurEvent() {
        this.footerBox.on('blur', () => {
            this.footerBox.style = { ...this.footerBox.style, bg: this.colors.bottom_bg };
        });
    }

    // direction: 'prev' || 'next'
    moveToWidget(direction, callback) {
        try {
            const nextWidgetIndex =
                direction === 'next' ? this.currentWidgetIndex + 1 : this.currentWidgetIndex - 1;

            const nextWidget = this.widgets[nextWidgetIndex];
            const currWidget = this.widgets[this.currentWidgetIndex];

            if (!currWidget) {
                throw new Error('The next widget index is outside the bounds of the widgets array');
            }

            this.currentWidgetIndex = nextWidgetIndex;

            if (nextWidget) {
                direction === 'prev' && currWidget.select && currWidget.select(0);
                currWidget.detach();
                this.bodyBox.append(nextWidget);

                callback && callback(nextWidget);

                nextWidget.focus();
            } else {
                this.terminate();
            }
        } catch (e) {
            // this.terminate(1, e);
        }
    }

    setTitleFooterContent(leftTitleText = '', rightTitleText = '', footerText = '') {
        this.titleBox.setContent(
            `${leftTitleText} {|}{${this.colors.top_right_color}-fg}${rightTitleText}{/}`
        );
        this.footerBox.setContent(footerText);
        this.screen.render();
    }

    resetScroll(widget, offset = 0) {
        widget.scrollTo(offset);
        widget.select(offset);
    }

    async terminate(exitCode = 0, message) {
        this.crawler && (await this.crawler.close());
        !exitCode && blessed.program().clear();
        message && console[exitCode ? 'error' : 'log'](message);
        return process.exit(exitCode);
    }
}

module.exports = CLI;
