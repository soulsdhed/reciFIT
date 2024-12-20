const express = require("express");
require("dotenv").config();
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("./config/passport");
const scheduler = require("./jobs/scheduler");
const webPush = require("web-push");

const app = express();
const PORT = process.env.PORT || 3001;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webPush.setVapidDetails(
  "mailto:projectrecifit@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // "http://192.168.100.64:3001",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
};

// router
const indexRouter = require("./routes/index");
const apiRouter = require("./routes/api");

// react
app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

// cookie parser
app.use(cookieParser());

// cors
app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// passport
app.use(passport.initialize());

// routing
app.use("/api", apiRouter);
app.use("/", indexRouter);

// scheduler
scheduler.startSchedulers();

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
