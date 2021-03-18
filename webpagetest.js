let testURL = process.argv[2];
let pageName = process.argv[3];
let connectivityProfile = process.argv[4];
let mobileEmulationBool = process.argv[5];

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
    location: "Test", // Or set a different test location
    firstViewOnly: false,
    connectivity: connectivityProfile,
    pollResults: 5,
    video: true,
    lighthouse: true
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
    let repeatView = result.data.median.repeatView;
    let firstMeaningfulPaint = repeatView.firstMeaningfulPaint,
      loadTime = firstView.loadTime,
      TTI = repeatView["chromeUserTiming.InteractiveTime"],
      bytesInDoc = firstView.bytesInDoc,
      requestsDoc = firstView.requestsDoc,
      fullyLoaded = firstView.fullyLoaded,
      visualComplete = firstView.visualComplete,
      timeToFirstByte = firstView.TTFB,
      firstContentfulPaint =
      repeatView["chromeUserTiming.firstContentfulPaint"],
      wptSpeedIndex = firstView.SpeedIndex,
      bytesHTML = firstView.breakdown.html.bytes,
      bytesJS = firstView.breakdown.js.bytes,
      bytesCSS = firstView.breakdown.css.bytes,
      bytesImages = firstView.breakdown.image.bytes,
      bytesFonts = firstView.breakdown.font.bytes;
  
      
    // Log some metrics to console
    let metrics = [loadTime, fullyLoaded, timeToFirstByte, firstContentfulPaint, firstMeaningfulPaint, TTI, wptSpeedIndex];
    for (metric of metrics) {
      console.log(metric);
    }
  
    // Write date to InfluxDB
    date *= 1000000000;
  
    influx
      .writePoints([
        {
          measurement: "webpagetest",
          tags: {
            pageName: pageName,
            run: 1
          },
          fields: {
            timeToInteractive: TTI,
            bytesInDoc: bytesInDoc,
            fullyLoaded: fullyLoaded,
            requestsDoc: requestsDoc,
            loadTime: loadTime,
            timeToFirstByte: timeToFirstByte,
            visualComplete: visualComplete,
            firstContentfulPaint: firstContentfulPaint,
            speedIndex: wptSpeedIndex,
            bytesHTML: bytesHTML,
            bytesJS: bytesJS,
            bytesCSS: bytesCSS,
            bytesImages: bytesImages,
            bytesFonts: bytesFonts
          },
          timestamp: date
        }
      ])
      .then(() => {
        return influx.query(`
          select * from webpagetest
          order by time desc
          `);
      })
      .catch(err => {
        console.error(`Error creating Influx database!` + err);
      });
  
  
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
  wpt.createVideo(testID, testOpts, (err, data) => {
    console.log(err || data);
    let videoId = data.data.videoId;
    videoDownloadURL += videoId;

    setTimeout(function () {
      download(videoDownloadURL, videoOptions, function (err) {
        if (err) throw err;
        console.log('########################################');
        console.log("Video download URL for " + pageName + ": " + videoDownloadURL);
        console.log('########################################');
      })
    }, 5000);

//     // // Download the filmstrip
//     // var filmstripURL = filmstripURL_start + testID + filmstripURL_end;

//     // download(filmstripURL, filmstripOptions, function (err) {
//     //   if (err) throw err;
//     //   console.log('########################################');
//     //   console.log("Filmstrip download URL for " + pageName + ": " + filmstripURL);
//     //   console.log('########################################');
//     // })

   });
});