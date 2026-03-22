import Anthropic from '@anthropic-ai/sdk';
import { anthropicConfig } from '../../config/anthropic';

const anthropicClient = new Anthropic({
  apiKey: anthropicConfig.apiKey,
});

export default anthropicClient;
