({
    baseUrl: "../../scripts/",
    paths: {
        "index": "../share/panel/index",
        "jquery": "jqueryStub",
        "widgets": "../share/panel/scripts/widgets"
    },
    name: "index",
    include: ['widgets/AccountPanelLinkedIn', 'AutoCompleteEmail', 'AutoCompleteTwitter'],
    exclude: ['jquery', 'require/text'],
    out: './index.js'
})
