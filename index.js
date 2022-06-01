const puppeteer = require('puppeteer');
const fs = require('fs');

const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const DOMAIN = 'https://www.fxstreet.com/';
const PAGEWIDTH = 360;

const RESTART = false;

let unvisitedUrls = [];
let visitedUrls = [];

try {
    const unvisitedUrlsString = fs.readFileSync("./unvisitedUrls.json", "utf8");
    const visitedUrlsString = fs.readFileSync("./visitedUrls.json", "utf8");
    unvisitedUrls = JSON.parse(unvisitedUrlsString)
    visitedUrls = JSON.parse(visitedUrlsString)
} catch (error) {
    console.log(error);
}

if(RESTART){
    unvisitedUrls = [...visitedUrls, ...unvisitedUrls];
    visitedUrls = [];
}


const csvWriter = createCsvWriter({
    path: 'fxsimagesattributes' + PAGEWIDTH + '.csv',
    header: [
        { id: 'img', title: 'IMG' },
        { id: 'imgnaturalwidth', title: 'IMG NATURAL WIDTH' },
        { id: 'imgnaturalheight', title: 'IMG NATURAL HEIGHT' },
        { id: 'imgoffsetWidth', title: 'IMG OFFSET WIDTH' },
        { id: 'imgoffsetHeight', title: 'IMG OFFSET HEIGHT' },
        { id: 'widthdiff', title: 'WIDTH DIFF' },
        { id: 'heightdiff', title: 'HEIGHT DIFF' },
        { id: 'context', title: 'CONTEXT' },
        { id: 'imgsrc', title: 'IMG SRC' },
        { id: 'pagewidth', title: 'PAGE WIDTH' },
        { id: 'pageurl', title: 'PAGE URL' },
    ],
    append:true
});

async function run(pageurl) {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: PAGEWIDTH, height: 100000 }
        });

        const page = await browser.newPage();

        await page.setCookie(
            {
                name: "PopupAd_roadblocks",
                value: "true",
                url: "https://www.fxstreet.com",
                httpOnly: false
            },
            {
                name: "policyAccepted",
                value: "",
                url: "https://www.fxstreet.com",
                httpOnly: false
            }
        );

        await page.goto(pageurl, { waitUntil: 'load', timeout: 0 });

        const domainUrls = await page.evaluate((domain) => {
            return Promise.resolve(Array.from(document.querySelectorAll(`[href^='${domain}']`)).map(item => item.href));
        }, DOMAIN);

        domainUrls.map(item => {
            if (!unvisitedUrls.includes(item) && !visitedUrls.includes(item)) {
                unvisitedUrls.push(item);
                fs.writeFileSync("unvisitedUrls.json", JSON.stringify(unvisitedUrls));
            }
        });

        const imagesAttributes = await page.evaluate(() => {
            return Array.from(
                document.querySelectorAll("img")
            ).map((image) => ({
                src: image.getAttribute("src"),
                naturalwidth: image.naturalWidth,
                naturalheight: image.naturalHeight,
                offsetWidth: image.offsetWidth,
                offsetHeight: image.offsetHeight
            }));
        });

        imagesAttributes.map(async img => {
            if (img.src) {
                await csvWriter.writeRecords([{
                    img: `=IMAGE(\"${img.src}\")`,
                    imgnaturalwidth: img.naturalwidth,
                    imgnaturalheight: img.naturalheight,
                    imgoffsetWidth: img.offsetWidth,
                    imgoffsetHeight: img.offsetHeight,
                    widthdiff: img.naturalwidth - img.offsetWidth,
                    heightdiff: img.naturalheight - img.offsetHeight,
                    imgsrc: img.src,
                    pagewidth: PAGEWIDTH,
                    pageurl: pageurl,
                    context: ' ',
                }]);
            }
        })

        browser.close();

        if (unvisitedUrls.length > 0) {
            const nextUrl = unvisitedUrls.pop();
            visitedUrls.push(nextUrl);
            fs.writeFileSync("visitedUrls.json", JSON.stringify(visitedUrls));
            await run(nextUrl);
        } else {
            console.log('Exiting process');
            process.exit();
        }
    } catch (error) {
        console.log(error);
    }
}

run(DOMAIN);
