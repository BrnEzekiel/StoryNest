import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from "react-native";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { AlertTriangle, RefreshCw, Home } from "lucide-react-native";
import { logErrorToBackend } from "../utils/ErrorHandler";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    logErrorToBackend(error, true);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.iconContainer}>
              <AlertTriangle size={64} color={Colors.accent} />
            </View>
            
            <Text style={styles.title}>Oops! Something went wrong.</Text>
            <Text style={styles.message}>
              StoryNest encountered an unexpected hiccup. Don't worry, our team has been notified.
            </Text>

            {__DEV__ && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error?.toString()}</Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                <RefreshCw size={20} color={Colors.primary} />
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={() => {/* This would ideally trigger a navigation reset or app reload */}}
              >
                <Home size={20} color={Colors.accent} />
                <Text style={[styles.buttonText, { color: Colors.accent }]}>Return to Nest</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#003631", // StoryNest primary dark
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  iconContainer: {
    marginBottom: 20,
    backgroundColor: "rgba(255, 237, 168, 0.1)",
    padding: 20,
    borderRadius: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFEDA8", // StoryNest accent
    textAlign: "center",
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: "#E8E0D5",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  debugContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 15,
    borderRadius: 8,
    width: "100%",
    marginBottom: 30,
  },
  debugTitle: {
    color: "#FFEDA8",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  debugText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "monospace",
  },
  buttonContainer: {
    width: "100%",
    gap: 15,
  },
  button: {
    backgroundColor: "#FFEDA8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FFEDA8",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#003631",
  },
});
