const { default: axios } = require('axios');
const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3003;
const qs = require('qs');
const R = require('ramda');

const mockFirstQuarter = fs.readFileSync('./src/mockFirstQuarter.xml', {
  encoding: 'utf-8',
});

const xml2js = require('xml2js');
const { Parser } = require('json2csv');
const xmlcsv = require('xml-csv');
const xml2csv = require('@wmfs/xml2csv');
const format = require('xml-formatter');

const SMD_AUTH_BASE_URL = `https://sharemydataqa.pge.com/myAuthorization/`;
const PGE_API_BASE_URL = `https://apiqa.pge.com`;

const QA_CLIENT_ID = '<SECRET_STRING>';
const QA_CLIENT_SECRET = '<SECRET_STRING>';
const PROD_CLIENT_ID = '<SECRET_STRING>';

const CLIENT_ID = QA_CLIENT_ID;
const CLIENT_SECRET = QA_CLIENT_SECRET;

const divideBy = (d) => (n) => n / d;

const daysAgo = (num) =>
  R.compose(Math.floor, divideBy(1000), (today) =>
    new Date(today).setDate(today.getDate() - num)
  )(new Date());

const today = new Date();
const twoDaysAgo = daysAgo(2);
const oneYearAgo = daysAgo(365);

const smdAuthParams = {
  client_id: CLIENT_ID,
  redirect_uri: 'https://www.isharefood.com/OAuthCallback',
  response_type: 'code',
  login: 'guest',
};

const withQuery = (params) => (url) =>
  `${url}${Object.keys(params).length ? '?' : ''}${qs.stringify(params)}`;

const encode64 = (str) => Buffer.from(str, 'utf-8').toString('base64');

// app.get('/', (req, res) => {
// console.log(mockFirstQuarter);
// var formattedXml = format(mockFirstQuarter);
// console.log(formattedXml);
// xml2csv(
//   {
//     xmlPath: './src/mockFirstQuarter.xml',
//     // xmlStream: mockFirstQuarter,
//     csvPath: './test_output.csv',
//     rootXMLElement: 'ns1:entry',
//     headerMap: [
//       ['ns1:id', 'SA_UUID', 'string', 'ns1:entry'],
//       ['ns1:updated', 'Interval Timestamp', 'string', 'ns1:entry'],
//       // ['ns0:IntervalBlock', 'Interval Value', 'string', 'ns1:content'],
//     ],
//   },
//   (err, info) => {
//     res.send({ err, info });
//     console.log(err, info);
//   }
// );
// });

app.get('/', (req, res) => {
  const url = withQuery(smdAuthParams)(SMD_AUTH_BASE_URL);
  res.redirect(url);
});

app.get('/OAuthCallback', async (req, res, next) => {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encode64(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
  };

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync('ssl/certs/isharefood.com/certificate.crt'),
    key: fs.readFileSync('ssl/private/isharefood.com/private.key'),
  });

  const data = {
    grant_type: 'authorization_code',
    code: req.query.code,
    redirect_uri: 'https://www.isharefood.com/OAuthCallback',
  };

  const result = await axios.post(
    withQuery(data)(`https://apiqa.pge.com/datacustodian/oauth/v2/token`),
    // TODO: data payload could be necessary arg, currently works as params above ^^^
    '',
    { httpsAgent, headers }
  );
  req.data = result.data;
  next();
});

app.get('/OAuthCallback', async (req, res, next) => {
  const accessToken = req.data.access_token;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync('ssl/certs/isharefood.com/certificate.crt'),
    key: fs.readFileSync('ssl/private/isharefood.com/private.key'),
  });

  const subscriptionId = req.data.resourceURI.replace(
    'https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/',
    ''
  );

  const usagePointIdResponse = await axios.get(
    `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Subscription/${subscriptionId}/UsagePoint`,
    { httpsAgent, headers }
  );

  const usagePointId = usagePointIdResponse.data.match(
    /\/UsagePoint\/([0-9]+)/
  )[1];

  // const params = {
  //   'published-max': twoDaysAgo,
  //   'published-min': oneYearAgo,
  // };

  // Splitting annual usage request into quarters
  // FirstQuarter
  const twoDaysAgo = daysAgo(2);
  const ninetyOneDaysAgo = daysAgo(91);
  const firstQuarterParams = {
    'published-max': twoDaysAgo,
    'published-min': ninetyOneDaysAgo,
  };

  const firstQuarterEnergyUsageResponse = await axios.get(
    withQuery(firstQuarterParams)(
      `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    ),
    { httpsAgent, headers }
  );

  fs.writeFile(
    './src/firstQuarter.xml',
    firstQuarterEnergyUsageResponse.data,
    (err) => {
      if (err) {
        console.error('failure writing file', err);
        return;
      }
    }
  );

  // SecondQuarter
  const publishedMax = daysAgo(92);
  const publishedMin = daysAgo(182);
  const secondQuarterParams = {
    'published-max': publishedMax,
    'published-min': publishedMin,
  };

  const secondQuarterEnergyResponse = await axios.get(
    withQuery(secondQuarterParams)(
      `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    ),
    { httpsAgent, headers }
  );

  fs.writeFile(
    './src/secondQuarter.xml',
    secondQuarterEnergyResponse.data,
    (err) => {
      if (err) {
        console.error('failure writing file', err);
        return;
      }
    }
  );

  // // ThirdQuarter
  // const publishedMax = daysAgo(183);
  // const publishedMin = daysAgo(274);
  // const thirdQuarterParams = {
  //   'published-max': publishedMax,
  //   'published-min': publishedMin,
  // };

  // const secondQuarterEnergyResponse = await axios.get(
  //   withQuery(thirdQuarterParams)(
  //     `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
  //   ),
  //   { httpsAgent, headers }
  // );

  // fs.writeFile(
  //   './src/thirdQuarter.xml',
  //   thirdQuarterEnergyResponse.data,
  //   (err) => {
  //     if (err) {
  //       console.error('failure writing file', err);
  //       return;
  //     }
  //   }
  // );

  // // FourthQuarter
  // const publishedMax = daysAgo(274);
  // const publishedMin = daysAgo(365);
  // const fourthQuarterParams = {
  //   'published-max': publishedMax,
  //   'published-min': publishedMin,
  // };

  // const fourthQuarterEnergyResponse = await axios.get(
  //   withQuery(fourthQuarterParams)(
  //     `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
  //   ),
  //   { httpsAgent, headers }
  // );

  // fs.writeFile(
  //   './src/fourthQuarter.xml',
  //   fourthQuarterEnergyResponse.data,
  //   (err) => {
  //     if (err) {
  //       console.error('failure writing file', err);
  //       return;
  //     }
  //   }
  // );

  // display formatted xml for easier nesting visualizing
  var formattedXml = format(firstQuarterEnergyUsageResponse.data);
  console.log(formattedXml);

  const outputDate = today.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  xml2csv(
    {
      xmlPath: './src/firstQuarter.xml',
      csvPath: `./${subscriptionId}-${outputDate}.csv`,
      rootXMLElement: 'ns1:entry',
      headerMap: [
        ['ns1:id', 'SA_UUID', 'string', 'ns1:entry'],
        ['ns1:published', 'Interval Timestamp', 'string', 'ns1:entry'],
        // ['ns0:IntervalBlock', 'Interval Value', 'string', 'ns1:content'],
      ],
    },
    (err, info) => {
      res.send({ err, info });
      console.log(err, info);
    }
  );
});

app.listen(port, (_) => {
  console.log(`App Listening at http://localhost:${port}`);
});
