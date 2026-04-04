import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import i18n from "../locales/i18n";

export default function RoleScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState(i18n.locale);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const changeLanguage = async (lang: string) => {
    const isRTL = lang === "ar";
    setLanguage(lang);
    i18n.locale = lang;
    await AsyncStorage.setItem("appLang", lang);
    
    // Force RTL/LTR change
    I18nManager.forceRTL(isRTL);
    I18nManager.swapLeftAndRightInRTL(isRTL);
    
    // Force a small delay to ensure state is saved
    setTimeout(() => {
      // The UI should update, but for complete RTL change, app restart may be needed
    }, 50);
  };

  const roles = [
    {
      key: "player",
      icon: "football-outline",
      en: "Player",
      ar: "لاعب",
      route: "/signup-player-profile",
    },
    {
      key: "agent",
      icon: "briefcase-outline",
      en: "Agent",
      ar: "وكيل",
      route: "/signup-agent-profile",
    },
    {
      key: "academy",
      icon: "school-outline",
      en: "Academy",
      ar: "أكاديمية",
      route: "/signup-academy-profile",
    },
    {
      key: "parent",
      icon: "people-outline",
      en: "Parent",
      ar: "ولي أمر",
      route: "/signup-parent-profile",
    },
    {
      key: "clinic",
      icon: "medical-outline",
      en: "Clinic",
      ar: "عيادة",
      route: "/signup-clinic-profile",
    },
  ];

  return (
    <LinearGradient
      colors={["#000000", "#1a1a1a", "#2d2d2d"]}
      style={styles.gradient}
    >
      {/* Back Button - Outside ScrollView */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons
          name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={require("../assets/forsa-logo.png")} style={styles.logo} />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {language === "ar" ? "اختر الدور الخاص بك" : "Select Your Role"}
          </Text>
          <Text style={styles.subtitle}>
            {language === "ar"
              ? "اختر نوع الحساب الذي تريد إنشاءه"
              : "Choose the type of account you want to create"}
          </Text>

          {/* Role Buttons - Grid Layout */}
          <View style={styles.rolesContainer}>
            {roles.map((role, index) => {
              return (
                <TouchableOpacity
                  key={role.key}
                  style={styles.roleCard}
                  onPress={() => router.push(role.route as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      index % 2 === 0
                        ? ["#ffffff", "#f8f8f8"]
                        : ["#ffffff", "#f8f8f8"]
                    }
                    style={styles.roleCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.roleCardContent}>
                      <View
                        style={[
                          styles.roleIconContainer,
                          index % 2 === 0
                            ? styles.roleIconContainerLight
                            : styles.roleIconContainerLight,
                        ]}
                      >
                        <Ionicons
                          name={role.icon as any}
                          size={40}
                          color={index % 2 === 0 ? "#fff" : "#fff"}
                        />
                      </View>
                      <Text
                        style={[
                          styles.roleCardText,
                          index % 2 === 0
                            ? styles.roleCardTextLight
                            : styles.roleCardTextLight,
                        ]}
                      >
                        {language === "ar" ? role.ar : role.en}
                      </Text>
                      {/* <View
                        style={[
                          styles.roleCardArrow,
                          index % 2 === 0
                            ? styles.roleCardArrowLight
                            : styles.roleCardArrowDark,
                        ]}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={
                            index % 2 === 0
                              ? "rgba(0,0,0,0.5)"
                              : "rgba(255,255,255,0.7)"
                          }
                        />
                      </View> */}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Language Switcher */}
          <View style={styles.languageContainer}>
            <Text style={styles.languageLabel}>
              {language === "ar" ? "اللغة" : "Language"}
            </Text>
            <View style={styles.langSwitchRow}>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  language === "en" && styles.langButtonActive,
                ]}
                onPress={() => changeLanguage("en")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={language === "en" ? "#fff" : "#666"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.langButtonText,
                    language === "en" && styles.langButtonTextActive,
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  language === "ar" && styles.langButtonActive,
                ]}
                onPress={() => changeLanguage("ar")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={language === "ar" ? "#fff" : "#666"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.langButtonText,
                    language === "ar" && styles.langButtonTextActive,
                  ]}
                >
                  العربية
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
  },
  content: {
    width: "100%",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    zIndex: 100,
  },
  logoContainer: {
    alignItems: "center",
    // marginBottom: 30,
  },
  logo: {
    width: 180,
    height: 150,
    resizeMode: "contain",
    tintColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginBottom: 40,
  },
  rolesContainer: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  roleCard: {
    width: "48%",
    marginBottom: 16,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    height: 180,
  },
  roleCardGradient: {
    borderRadius: 24,
    height: "100%",
    width: "100%",
  },
  roleCardContent: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
    position: "relative",
  },
  roleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  roleIconContainerLight: {
    backgroundColor: "#000",
  },
  roleIconContainerDark: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  roleCardText: {
    fontSize: 19,
    fontWeight: "bold",
    letterSpacing: 0.5,
    textAlign: "center",
    // marginTop: 8,
  },
  roleCardTextLight: {
    color: "#000",
  },
  roleCardTextDark: {
    color: "#fff",
  },
  roleCardArrow: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  roleCardArrowLight: {
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  roleCardArrowDark: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  languageContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 20,
  },
  languageLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  langSwitchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  langButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  langButtonActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  langButtonText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    fontWeight: "600",
  },
  langButtonTextActive: {
    color: "#000",
    fontWeight: "bold",
  },
});
