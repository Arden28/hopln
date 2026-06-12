import React from 'react';
import { Text } from 'react-native';

/**
 * Parses string content for **bold** Markdown tokens and returns 
 * a nested React Native Text component structure.
 */
export const renderMarkdownText = (text: string, baseStyle: any, boldColor: string) => {
  if (!text) return null;

  // Splits the text by capturing anything inside **bold**
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <Text style={baseStyle}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={index} style={{ fontWeight: '700', color: boldColor }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};