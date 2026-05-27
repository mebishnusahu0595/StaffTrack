import { ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Button, Card, List, Text } from "react-native-paper";

import { useAuth } from "../auth/AuthContext";

export function ProfileScreen() {
  const { companyName, signOut, user } = useAuth();

  const getLast5 = (value?: string) => {
    if (!value || value === "Not available") return "Not available";
    return value.slice(-5);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.profileHeader}>
        {user?.avatarUrl ? (
          <Avatar.Image source={{ uri: user.avatarUrl }} size={80} />
        ) : (
          <Avatar.Icon icon="account" size={80} style={{ backgroundColor: "#E8F0FE" }} color="#1A202C" />
        )}
        <Text style={styles.userName} variant="headlineSmall">
          {user?.name ?? "User"}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <Text style={styles.roleBadge}>{user?.role}</Text>
      </View>

      <Card mode="elevated" style={styles.card}>
        <List.Section>
          <List.Item
            description={getLast5(companyName ?? user?.companyId)}
            left={(props) => <List.Icon {...props} icon="office-building" />}
            title="Company"
          />
          <List.Item
            description={getLast5(user?.id)}
            left={(props) => <List.Icon {...props} icon="badge-account" />}
            title="Employee ID"
          />
          <List.Item
            description={user?.phone ?? "Not available"}
            left={(props) => <List.Icon {...props} icon="phone" />}
            title="Phone"
          />
        </List.Section>
      </Card>

      <Button icon="logout" mode="outlined" onPress={signOut} textColor="#A4262C">
        Log out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    padding: 20
  },
  profileHeader: {
    alignItems: "center",
    gap: 8,
    marginVertical: 28
  },
  userName: {
    color: "#24312D",
    fontWeight: "700",
    marginTop: 8
  },
  userEmail: {
    color: "#66736F"
  },
  roleBadge: {
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    color: "#174EA6",
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  card: {
    borderRadius: 8,
    marginBottom: 24
  }
});
