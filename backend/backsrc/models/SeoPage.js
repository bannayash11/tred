import mongoose from 'mongoose';

const seoPageSchema = new mongoose.Schema(
  {
    pageKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    path: {
      type: String,
      required: true,
      trim: true
    },
    pageName: {
      type: String,
      required: true,
      trim: true
    },
    metaTitle: {
      type: String,
      default: '',
      trim: true
    },
    metaDescription: {
      type: String,
      default: '',
      trim: true
    },
    metaKeywords: {
      type: String,
      default: '',
      trim: true
    },
    ogTitle: {
      type: String,
      default: '',
      trim: true
    },
    ogDescription: {
      type: String,
      default: '',
      trim: true
    },
    ogImage: {
      type: String,
      default: '',
      trim: true
    },
    canonicalUrl: {
      type: String,
      default: '',
      trim: true
    },
    robots: {
      type: String,
      default: 'index, follow',
      trim: true
    },
    schemaMarkup: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export const SeoPage = mongoose.model('SeoPage', seoPageSchema);
