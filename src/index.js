const { default: axios } = require('axios');
const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3003;
const qs = require('qs');
const R = require('ramda');

const xml2js = require('xml2js');

const SMD_AUTH_BASE_URL = `https://sharemydataqa.pge.com/myAuthorization/`;
const PGE_API_BASE_URL = `https://apiqa.pge.com`;

const QA_CLIENT_ID = '9b7c5685336b46f19dcc641a59271f3a';
const QA_CLIENT_SECRET = '6b7c8eaa8df144c98ea17faa9cbd9eaf';
const PROD_CLIENT_ID = '72131a63bbf347de9186bfa6d422b601';

const CLIENT_ID = QA_CLIENT_ID;
const CLIENT_SECRET = QA_CLIENT_SECRET;

const divideBy = (d) => (n) => n / d;

const daysAgo = (num) =>
  R.compose(Math.floor, divideBy(1000), (today) =>
    new Date(today).setDate(today.getDate() - num)
  )(new Date());

const today = new Date();

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
  const twoDaysAgo = daysAgo(2);
  const ninetyOneDaysAgo = daysAgo(91);
  const firstQuarterParams = {
    'published-max': twoDaysAgo,
    'published-min': ninetyOneDaysAgo,
  };

  const firstQuarterEnergyUsageResponse = axios.get(
    withQuery(firstQuarterParams)(
      `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    ),
    { httpsAgent, headers }
  );

  // SecondQuarter
  const ninetyTwoDaysAgo = daysAgo(92);
  const OneHundredEightyTwoDaysAgo = daysAgo(182);
  const secondQuarterParams = {
    'published-max': ninetyTwoDaysAgo,
    'published-min': OneHundredEightyTwoDaysAgo,
  };

  const secondQuarterEnergyResponse = axios.get(
    withQuery(secondQuarterParams)(
      `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    ),
    { httpsAgent, headers }
  );

  // ThirdQuarter
  const oneHundredEightyThreeDaysAgo = daysAgo(183);
  const twoHundredSeventyFourDaysAgo = daysAgo(274);
  const thirdQuarterParams = {
    'published-max': oneHundredEightyThreeDaysAgo,
    'published-min': twoHundredSeventyFourDaysAgo,
  };

  const thirdQuarterEnergyResponse = axios.get(
    withQuery(thirdQuarterParams)(
      `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    ),
    { httpsAgent, headers }
  );

  // FourthQuarter
  const twoHundredSeventyFiveDaysAgo = daysAgo(275);
  const threeHundredSixtyFiveDaysAgo = daysAgo(365);
  const fourthQuarterParams = {
    'published-max': twoHundredSeventyFiveDaysAgo,
    'published-min': threeHundredSixtyFiveDaysAgo,
  };

  const fourthQuarterEnergyResponse = axios.get(
    withQuery(fourthQuarterParams)(
      `https://apiqa.pge.com/GreenButtonConnect/espi/1_1/resource/Batch/Subscription/${subscriptionId}/UsagePoint/${usagePointId}`
    ),
    { httpsAgent, headers }
  );

  Promise.all([
    firstQuarterEnergyUsageResponse,
    secondQuarterEnergyResponse,
    thirdQuarterEnergyResponse,
    fourthQuarterEnergyResponse,
  ]).then((values) => {
    const csvContent = ['SA_UUID, Interval Timestamp, Interval Value'];
    values.map((value, index) => {
      // convert XML to JSON
      xml2js.parseString(value.data, (err, result) => {
        if (err) {
          throw err;
        }

        const response = result['ns1:feed']['ns1:entry'].reduce(
          (acc, item, index) => {
            if (
              item['ns1:content'] &&
              item['ns1:content'][0]['ns0:IntervalBlock']
            ) {
              const intervalReading = item['ns1:content'][0][
                'ns0:IntervalBlock'
              ][0]['ns0:IntervalReading'].reduce((accIR, itemIR) => {
                const date = new Date(0);
                const newDate = date.toUTCString(
                  itemIR['ns0:timePeriod'][0]['ns0:start'][0]
                );

                return [
                  ...accIR,
                  `${subscriptionId},${newDate},${itemIR['ns0:value'][0]}`,
                ];
              }, []);
              return [...acc, ...intervalReading];
            }
            return acc;
          },
          []
        );
        csvContent.push(...response);

        const outputDate = today
          .toISOString()
          .replace(/T/, ' ')
          .replace(/\..+/, '');

        if (index === 0) {
          fs.writeFileSync(
            `${subscriptionId}-${outputDate}`,
            csvContent.join('\n')
          );
        } else {
          fs.appendFileSync(
            `${subscriptionId}-${outputDate}`,
            csvContent.join('\n')
          );
        }
      });
    });
    res.send('created csv succesfully');
  });
});

app.listen(port, (_) => {
  console.log(`App Listening at http://localhost:${port}`);
});
