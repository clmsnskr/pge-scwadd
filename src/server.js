const { default: axios } = require('axios');
const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3003;
const qs = require('qs');
const R = require('ramda');
const path = require('path');

const xml2js = require('xml2js');

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

const smdAuthParams = {
  client_id: CLIENT_ID,
  redirect_uri: 'http://scwadd.isharefood.com/OAuthCallback',
  response_type: 'code',
  login: 'guest',
};

const withQuery = (params) => (url) =>
  `${url}${Object.keys(params).length ? '?' : ''}${qs.stringify(params)}`;

const encode64 = (str) => Buffer.from(str, 'utf-8').toString('base64');
const decode64 = (str) => Buffer.from(str, 'base64').toString('utf-8');

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
    redirect_uri: 'http://scwadd.isharefood.com/OAuthCallback',
  };

  const result = await axios.post(
    withQuery(data)(`https://apiqa.pge.com/datacustodian/oauth/v2/token`),
    // TODO: data payload could be necessary arg, currently works as params above ^^^
    '',
    { httpsAgent, headers }
  );

  //request for client_access_token to be used in destroying session
  const clientCredentialsData = {
    grant_type: 'client_credentials',
  };
  const clientAccessTokenResponse = await axios.post(
    withQuery(clientCredentialsData)(
      `https://apiqa.pge.com/datacustodian/oauth/v2/token`
    ),
    '',
    { httpsAgent, headers }
  );

  req.data = {
    ...result.data,
    clientAccessToken: clientAccessTokenResponse.data.client_access_token,
  };
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
    fourthQuarterEnergyResponse,
    thirdQuarterEnergyResponse,
    secondQuarterEnergyResponse,
    firstQuarterEnergyUsageResponse,
  ]).then((values) => {
    const csvContent = [
      'SA_UUID, Interval Timestamp, Delivered From Grid Value (Wh), Back To Grid Value (Wh)',
    ];
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
              // retrieves energyFlowIndicator to determine if interval value is DeliveredFromGrid OR BackToGrid
              const energyFlowUrl = item['ns1:link'][0]['$'].href;
              const energyFlowIndicatorString = energyFlowUrl.split('/')[12];
              const firstBufferString = decode64(energyFlowIndicatorString);
              const secondBufferString = decode64(firstBufferString);
              const energyFlowIndicator = R.compose(
                (arr) => arr[arr.length - 1]
              )(secondBufferString.split(':'));

              const intervalReading = item['ns1:content'][0][
                'ns0:IntervalBlock'
              ][0]['ns0:IntervalReading'].reduce((accIR, itemIR) => {
                const itemStartTime =
                  itemIR['ns0:timePeriod'][0]['ns0:start'][0];
                const itemValue = itemIR['ns0:value'][0];

                const itemByStartTime = {
                  start: itemStartTime,
                  ...(energyFlowIndicator === '19'
                    ? { generated: itemValue }
                    : { delivered: itemValue }),
                };

                return [...accIR, itemByStartTime];
              }, []);
              return [...acc, ...intervalReading];
            }
            return acc;
          },
          []
        );

        const groupedByStart = R.groupBy(({ start }) => start)(response);
        const csvLines = Object.keys(groupedByStart).map((startTime) => {
          const entry = groupedByStart[startTime];
          const newDate = new Date(+startTime * 1000);

          const entryObj = {
            ...entry[0],
            ...entry[1],
          };

          return `${subscriptionId}, ${newDate}, ${
            +entryObj.delivered * 10 ** -3
          }, ${+entryObj.generated * 10 ** -3}`;
        });

        const outputDate = today
          .toISOString()
          .replace(/T/, ' ')
          .replace(/\..+/, '');

        if (index === 0) {
          csvContent.push(...csvLines);
          if (!fs.existsSync('output')) fs.mkdirSync('output');
          fs.writeFileSync(
            `output/${subscriptionId}-${outputDate}.csv`,
            csvContent.join('\n')
          );
        } else {
          //creates new line before appending values
          fs.appendFileSync(`output/${subscriptionId}-${outputDate}.csv`, '\n');
          fs.appendFileSync(
            `output/${subscriptionId}-${outputDate}.csv`,
            csvLines.join('\n')
          );
        }
      });
    });
    next();
  });
});

app.use(async (req, res, next) => {
  // For data access client level URI endpoints, the bearer CLIENT ACCESS TOKEN is required
  const clientAccessToken = req.data.clientAccessToken;
  const headers = {
    Authorization: `Bearer ${clientAccessToken}`,
  };
  const httpsAgent = new https.Agent({
    cert: fs.readFileSync('ssl/certs/isharefood.com/certificate.crt'),
    key: fs.readFileSync('ssl/private/isharefood.com/private.key'),
  });
  try {
    await axios.delete(`${req.data.authorizationURI}`, {
      httpsAgent,
      headers,
    });
  } catch (e) {
    console.log(e, 'There was an error');
  }

  // user confirmation page
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, (_) => {
  console.log(`App Listening at http://localhost:${port}`);
});
