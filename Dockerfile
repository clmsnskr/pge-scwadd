FROM node:alpine3.15

EXPOSE 3000
RUN mkdir -p /opt/app/src
WORKDIR /opt/app/src

ADD package.json /opt/app/.
ADD package-lock.json /opt/app/.
RUN npm install

ADD ./src /opt/app/src
# ADD ./ssl /opt/app/ssl

CMD ["npm","run","dev"]