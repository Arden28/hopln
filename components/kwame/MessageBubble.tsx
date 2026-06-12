// components/kwame/MessageBubble.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { renderMarkdownText } from '../../utils/markdown';

const { width } = Dimensions.get('window');
const ORANGE = "#FF6F00";

// Internal streaming component piped through Markdown
const TypewriterText = ({ text, animate, color, style }: { text: string, animate: boolean, color: string, style: any }) => {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);
  
  useEffect(() => {
    if (!animate) { 
      setDisplayedText(text); 
      return; 
    }
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, 20); // Typing speed
    
    return () => clearInterval(timer);
  }, [text, animate]);

  return renderMarkdownText(displayedText, style, color);
};

export default function MessageBubble({ msg, C, isStreaming }: { msg: any, C: any, isStreaming: boolean }) {
  const isUser = msg.role === 'user';

  return (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : [styles.aiBubble, { backgroundColor: C.bubbleAI }]]}>
      {isUser ? (
        <Text style={[styles.messageText, { color: '#FFFFFF' }]}>{msg.text}</Text>
      ) : (
        <TypewriterText 
          text={msg.text} 
          animate={isStreaming} 
          color={C.text} 
          style={[styles.messageText, { color: C.text }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  messageBubble: { 
    maxWidth: width * 0.82, 
    paddingHorizontal: 16, 
    paddingVertical: 11, 
    borderRadius: 18 
  },
  userBubble: { 
    backgroundColor: ORANGE, 
    borderBottomRightRadius: 4 
  },
  aiBubble: { 
    borderBottomLeftRadius: 4 
  },
  messageText: { 
    fontSize: 15, 
    lineHeight: 21 
  },
});