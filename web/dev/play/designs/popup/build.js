({
    baseUrl: "../../../scripts/",
    paths: {
        "index": "../play/designs/popup/index",
        "jquery": "jqueryStub",
        "widgets": "../play/designs/popup/scripts/widgets"
    },
    name: "index",
    include: ['widgets/AccountPanelLinkedIn'],
    exclude: ['jquery', 'require/text'],
    out: './index.js'
})
