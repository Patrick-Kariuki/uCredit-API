const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/*  
    This model refers to specific courses that a student takes.
    Some fields are not required in order to support customized courses.
*/
const courseSchema = new Schema({
  title: { type: String, required: true },
  term: {
    type: String,
    required: true,
    enum: ["fall", "spring", "summer", "intersession"],
  },
  year: {
    type: String,
    required: true,
    enum: ["freshman", "sophomore", "junior", "senior"],
  },
  number: String,
  department: String,
  tags: [{ type: String }],
  area: String,
  credits: { type: Number, required: true },
  wi: { type: Boolean, default: false },
  taken: { type: Boolean, default: false },
  ratings: Array,
  distribution_ids: [
    { type: Schema.Types.ObjectId, ref: "Distribution", required: true },
  ],
  user_id: { type: String, required: true },
});

//custom static model functions
courseSchema.statics.findByDistributionId = function (d_id) {
  return this.find({ distribution_ids: d_id });
};

courseSchema.statics.findByUserId = function (user_id) {
  return this.find({ user_id });
};

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
