import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props {
  text: string;
  animate: boolean;
  color: string;
}

export default function TypewriterText({ text, animate, color }: Props) {
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
    }, 20);
    return () => clearInterval(timer);
  }, [text, animate]);

  return <Text style={[styles.messageText, { color }]}>{displayedText}</Text>;
}

const styles = StyleSheet.create({
  messageText: { fontSize: 15, lineHeight: 21 },
});