let testURL = process.argv[2];
let pageName = process.argv[3];
let connectivityProfile = process.argv[4];
let browser = process.argv[5];

const WebPageTest = require("webpagetest");
const fs = require("fs");
const download = require('file-download')
const wpt = new WebPageTest("localhost:4000");
const Influx = require("influx");
const influx = new Influx.InfluxDB({
  host: "localhost",
  database: "webpagetest",
  port: 8086
});
module.exports = influx;

let path = "./results/";
let videoDownloadURL = "http://localhost:4000/video/download.php?id=";
let filmstripURL_start =
  "http://localhost:4000/video/filmstrip.php?tests=";
let filmstripURL_end =
  "-r:1-c:0&thumbSize=200&ival=500&end=visual&text=ffffff&bg=000000";

  let testStart = new Date().toISOString();
  const testOpts = {
    emulateMobile: false,
    location: "Test:" + browser, // Or set a different test location
    browser: browser,
    firstViewOnly: false,
    connectivity: connectivityProfile,
    pollResults: 5,
    video: true,
    lighthouse: false,
  };
  
  const script = wpt.scriptToString([
    { navigate: testURL },
    "waitForComplete"
  ]);
  
  
  // Run a test on WebPagetest
  console.log(
    `${testStart}:\nStarting Webpagetest for ${testURL} with ${connectivityProfile} connectivity...`
  );
  
  wpt.runTest(script, testOpts, (err, result) => {
    if (err) {
      console.log("Can't run the test for some reason.");
      throw err;
    }
    let date = result.data.completed;
    let fileName = path + date + " - " + pageName + ".json";
    let testID = result.data.id;
  
    let stats = JSON.stringify(result.data, null, 2);
  
    // Metrics
    let firstView = result.data.median.firstView;
    // let repeatView = result.data.median.repeatView;
    let firstMeaningfulPaint = firstView.firstMeaningfulPaint,
      loadTime = firstView.loadTime,
      TTI = firstView.TTIMeasurementEnd,
      bytesInDoc = firstView.bytesInDoc,
      requestsDoc = firstView.requestsDoc,
      fullyLoaded = firstView.fullyLoaded,
      visualComplete = firstView.visualComplete,
      timeToFirstByte = firstView.TTFB,
      firstContentfulPaint = firstView.firstContentfulPaint,
      wptSpeedIndex = firstView.SpeedIndex,
      bytesHTML = firstView.breakdown.html.bytes,
      bytesJS = firstView.breakdown.js.bytes,
      bytesCSS = firstView.breakdown.css.bytes,
      bytesImages = firstView.breakdown.image.bytes,
      bytesFonts = firstView.breakdown.font.bytes,
      firstViewWaterfall = result.data.runs[1].firstView.images.waterfall;
  
      
    // Log some metrics to console
    console.log('Load time:', result.data.median.firstView.loadTime);
    console.log('First byte:', result.data.median.firstView.TTFB);
    console.log('Start render:', result.data.median.firstView.render);
    console.log('Speed Index:', result.data.median.firstView.SpeedIndex);
    console.log('DOM elements:', result.data.median.firstView.domElements);

    console.log('(Doc complete) Requests:', result.data.median.firstView.requestsDoc);
    console.log('(Doc complete) Bytes in:', result.data.median.firstView.bytesInDoc);

    console.log('(Fully loaded) Time:', result.data.median.firstView.fullyLoaded);
    console.log('(Fully loaded) Requests:', result.data.median.firstView.requestsFull);
    console.log('(Fully loaded) Bytes in:', result.data.median.firstView.bytesIn);

    console.log('Waterfall view:', result.data.runs[1].firstView.images.waterfall);
  
    // Write date to InfluxDB
    date *= 1000000000;
  
    influx
      .writePoints([
        {
          measurement: "webpagetest",
          tags: {
            pageName: pageName,
            run: 1,
          },
          fields: {
            testID: testID,
            timeToInteractive: TTI,
            bytesInDoc: bytesInDoc,
            fullyLoaded: fullyLoaded,
            requestsDoc: requestsDoc,
            loadTime: loadTime,
            timeToFirstByte: timeToFirstByte,
            visualComplete: visualComplete,
            firstContentfulPaint: firstContentfulPaint,
            firstMeaningfulPaint: firstMeaningfulPaint,
            speedIndex: wptSpeedIndex,
            bytesHTML: bytesHTML,
            bytesJS: bytesJS,
            bytesCSS: bytesCSS,
            bytesImages: bytesImages,
            bytesFonts: bytesFonts,
            waterfall : firstViewWaterfall,
          },
          timestamp: date
        }
      ])
      .then(() => {
        console.log("Finished writing in influxDB")
        return influx.query(`
          select * from webpagetest
          order by time desc
          `);
      })
      .catch(err => {
        console.error(`Error creating Influx database!` + err);
      });
  
    if (!fs.existsSync(path)){
        fs.mkdirSync(path);
    }

    // Save test results as JSON file
    fs.writeFile(fileName, stats, err => {
      if (err) throw err;
      console.log("Data for " + pageName + "written to file: " + fileName);
    });

  // Video Options
  var videoOptions = {
    directory: path,
    filename: date + " - " + pageName + ".mp4"
  }

  // Filmstrip options
  var filmstripOptions = {
    directory: path,
    filename: date + " - " + pageName + ".png"
  }

  // Method to create video of the page loading
  // wpt.createVideo(testID, testOpts, (err, data) => {
  //   console.log(data);
  //   let videoId = data.data.videoId;
  //   videoDownloadURL += videoId;

  //   setTimeout(function () {
  //     download(videoDownloadURL, videoOptions, function (err) {
  //       if (err) throw err;
  //       console.log('########################################');
  //       console.log("Video download URL for " + pageName + ": " + videoDownloadURL);
  //       console.log('########################################');
  //     })
  //   }, 5000);

    // Download the filmstrip
    var filmstripURL = filmstripURL_start + testID + filmstripURL_end;

    download(filmstripURL, filmstripOptions, function (err) {
      if (err) throw err;
      console.log('########################################');
      console.log("Filmstrip download URL for " + pageName + ": " + filmstripURL);
      console.log('########################################');
    });

  //  });
});