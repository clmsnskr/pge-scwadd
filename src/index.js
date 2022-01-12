const { default: axios } = require("axios");
const https = require("https");
const fs = require("fs");
const express = require("express");
const app = express();
const port = 3003;

const SMD_AUTH_BASE_URL = `https://sharemydataqa.pge.com/myAuthorization/`;
const PGE_API_BASE_URL = `https://apiqa.pge.com`;

const QA_CLIENT_ID = "<SECRET_STRING>";
const PROD_CLIENT_ID = "<SECRET_STRING>";

const today = new Date();
const twoDaysAgo = new Date(today).setDate(today.getDate() - 2);
const oneYearAgo = new Date(today).setDate(today.getDate() - 365);

const smdAuthParams = {
  client_id: QA_CLIENT_ID,
  redirect_uri: "https://www.isharefood.com/OAuthCallback",
  response_type: "code",
  login: "guest",
  // scope: `MinAuthEndDate=${twoDaysAgo};PreferredAuthEndDate=${oneYearAgo}`
};

const withQuery = (query) => (url) => {
  const params = Object.keys(query).reduce(
    (acc, key, idx) => `${acc}${idx === 0 ? "?" : "&"}${key}=${query[key]}`,
    ""
  );
  return `${url}${params}`;
};

app.get("/", (req, res) => {
  const url = withQuery(smdAuthParams)(SMD_AUTH_BASE_URL);
  res.redirect(url);
});

app.get("/OAuthCallback", async (req, res, next) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Basic <SECRET_STRING>`,
  };
  const params = {
    grant_type: "authorization_code",
  };

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync("ssl/certs/isharefood.com/certificate.crt"),
    key: fs.readFileSync("ssl/private/isharefood.com/private.key"),
  });

  const data = {
    grant_type: "authorization_code",
    code: req.query.code,
    redirect_uri: "https://www.isharefood.com/OAuthCallback",
  };

  const result = await axios.post(
    withQuery(data)(`https://apiqa.pge.com/datacustodian/oauth/v2/token`),
    '',
    { httpsAgent, headers }
  );
  res.send(result.data);
});

app.listen(port, (_) => {
  console.log(`App Listening at http://localhost:${port}`);
});
