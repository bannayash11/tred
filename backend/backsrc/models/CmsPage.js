import mongoose from 'mongoose';

const faqItemSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const cmsPageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: ['privacy-policy', 'terms-and-conditions', 'faq']
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      default: ''
    },
    faqItems: {
      type: [faqItemSchema],
      default: []
    },
    isPublished: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export const CmsPage = mongoose.model('CmsPage', cmsPageSchema);
