const { default: axios } = require('axios');
const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3003;
const qs = require('qs');
const R = require('ramda');

const mockFirstQuarter = fs.readFileSync('./src/firstQuarter.xml', {
  encoding: 'utf-8',
});
const mockSecondQuarter = fs.readFileSync('./src/secondQuarter.xml', {
  encoding: 'utf-8',
});
const mockThirdQuarter = fs.readFileSync('./src/thirdQuarter.xml', {
  encoding: 'utf-8',
});
const mockFourthQuarter = fs.readFileSync('./src/fourthQuarter.xml', {
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

app.get('/', (req, res) => {
  /* Start of mock testing section, this work will be moved to API calls later */

  const outputDate = today.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  // convert XML to JSON
  // First quarter API call
  xml2js.parseString(mockFirstQuarter, (err, result) => {
    if (err) {
      throw err;
    }

    const firstCall = result['ns1:feed']['ns1:entry'].reduce(
      (acc, item, index) => {
        if (
          item['ns1:content'] &&
          item['ns1:content'][0]['ns0:IntervalBlock']
        ) {
          const intervalReading = item['ns1:content'][0][
            'ns0:IntervalBlock'
          ][0]['ns0:IntervalReading'].reduce((accIR, itemIR) => {
            return [
              ...accIR,
              `${item['ns1:id'][0]['_']},${itemIR['ns0:timePeriod'][0]['ns0:start'][0]},${itemIR['ns0:value'][0]}`,
            ];
          }, []);
          return [...acc, ...intervalReading];
        }
        return acc;
      },
      ['SA_UUID, Interval Timestamp, Interval Value']
    );

    fs.writeFileSync(`${subscriptionId}-${outputDate}`, firstCall.join('\n'));
  });

  // convert XML to JSON
  // Second quarter API call
  xml2js.parseString(mockSecondQuarter, (err, result) => {
    if (err) {
      throw err;
    }

    const secondCall = result['ns1:feed']['ns1:entry'].reduce(
      (acc, item, index) => {
        if (
          item['ns1:content'] &&
          item['ns1:content'][0]['ns0:IntervalBlock']
        ) {
          const intervalReading = item['ns1:content'][0][
            'ns0:IntervalBlock'
          ][0]['ns0:IntervalReading'].reduce((accIR, itemIR) => {
            return [
              ...accIR,
              `${item['ns1:id'][0]['_']},${itemIR['ns0:timePeriod'][0]['ns0:start'][0]},${itemIR['ns0:value'][0]}`,
            ];
          }, []);
          return [...acc, ...intervalReading];
        }
        return acc;
      },
      []
    );

    fs.appendFileSync(`${subscriptionId}-${outputDate}`, secondCall.join('\n'));
  });

  // convert XML to JSON
  // Third quarter API call
  xml2js.parseString(mockThirdQuarter, (err, result) => {
    if (err) {
      throw err;
    }

    const thirdCall = result['ns1:feed']['ns1:entry'].reduce(
      (acc, item, index) => {
        if (
          item['ns1:content'] &&
          item['ns1:content'][0]['ns0:IntervalBlock']
        ) {
          const intervalReading = item['ns1:content'][0][
            'ns0:IntervalBlock'
          ][0]['ns0:IntervalReading'].reduce((accIR, itemIR) => {
            return [
              ...accIR,
              `${item['ns1:id'][0]['_']},${itemIR['ns0:timePeriod'][0]['ns0:start'][0]},${itemIR['ns0:value'][0]}`,
            ];
          }, []);
          return [...acc, ...intervalReading];
        }
        return acc;
      },
      []
    );

    fs.appendFileSync(`${subscriptionId}-${outputDate}`, thirdCall.join('\n'));
  });

  // convert XML to JSON
  // Fourth quarter API call
  xml2js.parseString(mockFourthQuarter, (err, result) => {
    if (err) {
      throw err;
    }

    const fourthCall = result['ns1:feed']['ns1:entry'].reduce(
      (acc, item, index) => {
        if (
          item['ns1:content'] &&
          item['ns1:content'][0]['ns0:IntervalBlock']
        ) {
          const intervalReading = item['ns1:content'][0][
            'ns0:IntervalBlock'
          ][0]['ns0:IntervalReading'].reduce((accIR, itemIR) => {
            return [
              ...accIR,
              `${item['ns1:id'][0]['_']},${itemIR['ns0:timePeriod'][0]['ns0:start'][0]},${itemIR['ns0:value'][0]}`,
            ];
          }, []);
          return [...acc, ...intervalReading];
        }
        return acc;
      },
      []
    );

    fs.appendFileSync(`${subscriptionId}-${outputDate}`, fourthCall.join('\n'));
    /* End of mock testing section, this work will be moved to API calls later */

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

    // Splitting annual usage request into quarters
    // FirstQuarter
    // const twoDaysAgo = daysAgo(2);
    // const ninetyOneDaysAgo = daysAgo(91);
    // const firstQuarterParams = {
    //   'published-max': twoDaysAgo,
    //   'published-min': ninetyOneDaysAgo,
    // };

    // const firstQuarterEnergyUsageResponse = await axios.get(
    //   withQuery(firstQuarterParams)(
    //     `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    //   ),
    //   { httpsAgent, headers }
    // );

    // // SecondQuarter
    // const publishedMax = daysAgo(92);
    // const publishedMin = daysAgo(182);
    // const secondQuarterParams = {
    //   'published-max': publishedMax,
    //   'published-min': publishedMin,
    // };

    // const secondQuarterEnergyResponse = await axios.get(
    //   withQuery(secondQuarterParams)(
    //     `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    //   ),
    //   { httpsAgent, headers }
    // );

    // // ThirdQuarter
    // const publishedMax = daysAgo(183);
    // const publishedMin = daysAgo(274);
    // const thirdQuarterParams = {
    //   'published-max': publishedMax,
    //   'published-min': publishedMin,
    // };

    // const thirdQuarterEnergyResponse = await axios.get(
    //   withQuery(thirdQuarterParams)(
    //     `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    //   ),
    //   { httpsAgent, headers }
    // );

    // FourthQuarter
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
  });

  // display formatted xml for easier nesting visualizing
  // var formattedXml = format(firstQuarterEnergyUsageResponse.data);
  // console.log(formattedXml);
});

app.listen(port, (_) => {
  console.log(`App Listening at http://localhost:${port}`);
});
