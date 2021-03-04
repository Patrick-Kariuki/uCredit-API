const { ObjectId } = require("bson");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  _id: { type: String, required: true }, //JHED ID
  majors: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  affiliation: { type: String, required: true }, //STUDENT, FACULTY or STAFF
  freshman: [{ type: ObjectId, ref: "Course" }],
  sophomore: [{ type: ObjectId, ref: "Course" }],
  junior: [{ type: ObjectId, ref: "Course" }],
  senior: [{ type: ObjectId, ref: "Course" }],
  distributions: [{ type: ObjectId, ref: "Distribution" }],
});

userSchema.statics.findCoursesByTerm = async function (user_id, year, term) {
  const user = await this.findOne({ _id: user_id })
    .populate({ path: year, match: { term } })
    .exec();
  return user[year];
};

const User = mongoose.model("User", userSchema);

module.exports = User;
