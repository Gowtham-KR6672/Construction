const mongoose = require("mongoose");
 
mongoose
  .connect(
    "mongodb+srv://construction:Gowtham%406672@construction.ih3twzj.mongodb.net/?retryWrites=true&w=majority"
  )
  .then(() => {
    console.log("Connected");
    process.exit(0);
  })
  .catch((err) => {
    console. Error(err);
  });