module.exports = {
    baseUrl: 'http://www.slrclub.com/bbs/zboard.php',
    getUrl: (boardName) => `http://www.slrclub.com/bbs/zboard.php?id=${boardName}`,
    sortUrls: [
        {
            name: 'test',
        },
    ],
    boardTypes: ['커뮤니티'],
    ignoreBoards: [],
};
